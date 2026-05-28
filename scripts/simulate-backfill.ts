/**
 * One-shot mass backfill: writes a large batch of historical events (plus a
 * fresh batch of deployments for the Deployment Frequency chart) spread over a
 * past time range, then exits. Use this to populate charts/trends quickly —
 * the live `npm run simulate` is for an ongoing realistic trickle.
 *
 *   npm run simulate:backfill                 # 2000 events over the last 7 days
 *   COUNT=10000 DAYS=14 npm run simulate:backfill
 *
 * Shares the scenario pool + fingerprinting with simulate-events.ts, and lazily
 * creates any missing services — it never resets or wipes existing data.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Severity } from "../prisma/generated/client/client";
import { deriveIssueTitle } from "../lib/fingerprint";
import {
  renderEvent,
  resolveProject,
  makeServiceResolver,
  generateDeployments,
  type RenderedEvent,
} from "./event-source";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const SEVERITY_RANK: Record<Severity, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
};

const maxSeverity = (a: Severity, b: Severity): Severity =>
  SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;

type Generated = { event: RenderedEvent; at: Date };

type Agg = {
  event: RenderedEvent;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  severity: Severity;
};

async function main() {
  const count = Math.max(1, Number(process.env.COUNT ?? 2000));
  const days = Math.max(0, Number(process.env.DAYS ?? 7));
  const windowMs = days * 24 * 60 * 60 * 1000;
  const now = Date.now();

  console.log(`[backfill] generating ${count} events over the last ${days} day(s)…`);

  // Generate events with a recency bias (more recent = denser), then sort
  // ascending so firstSeen/lastSeen fall out naturally.
  const generated: Generated[] = [];
  for (let i = 0; i < count; i++) {
    const event = renderEvent();
    const bias = Math.random() ** 1.6; // skewed toward 0 → toward "now"
    generated.push({ event, at: new Date(now - bias * windowMs) });
  }
  generated.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Aggregate by fingerprint so each issue is upserted once.
  const byFingerprint = new Map<string, Agg>();
  for (const { event, at } of generated) {
    const agg = byFingerprint.get(event.fingerprint);
    if (!agg) {
      byFingerprint.set(event.fingerprint, {
        event,
        count: 1,
        firstSeen: at,
        lastSeen: at,
        severity: event.severity,
      });
    } else {
      agg.count++;
      if (at < agg.firstSeen) agg.firstSeen = at;
      if (at > agg.lastSeen) agg.lastSeen = at;
      agg.severity = maxSeverity(agg.severity, event.severity);
    }
  }

  const project = await resolveProject(prisma);
  const resolveService = makeServiceResolver(prisma, project.id);

  // Resolve (and lazily create) every service we touch.
  const serviceIdByName = new Map<string, string>();
  for (const name of new Set(generated.map((g) => g.event.service))) {
    const svc = await resolveService(name);
    serviceIdByName.set(name, svc.id);
  }

  // Upsert one issue per fingerprint, clamping the seen-window against any
  // existing row so we never move it the wrong way.
  console.log(`[backfill] upserting ${byFingerprint.size} issues…`);
  const issueIdByFingerprint = new Map<string, string>();
  for (const [fingerprint, agg] of byFingerprint) {
    const existing = await prisma.issue.findUnique({ where: { fingerprint } });
    const firstSeenAt =
      existing && existing.firstSeenAt < agg.firstSeen ? existing.firstSeenAt : agg.firstSeen;
    const lastSeenAt =
      existing && existing.lastSeenAt > agg.lastSeen ? existing.lastSeenAt : agg.lastSeen;
    const severity = existing ? maxSeverity(existing.severity, agg.severity) : agg.severity;

    const issue = await prisma.issue.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        title: deriveIssueTitle(agg.event.message),
        severity: agg.severity,
        firstSeenAt: agg.firstSeen,
        lastSeenAt: agg.lastSeen,
        occurrenceCount: agg.count,
      },
      update: {
        occurrenceCount: { increment: agg.count },
        firstSeenAt,
        lastSeenAt,
        severity,
        status: "OPEN",
      },
      select: { id: true },
    });
    issueIdByFingerprint.set(fingerprint, issue.id);
  }

  // Bulk-insert the events in chunks.
  const rows = generated.map(({ event, at }) => ({
    serviceId: serviceIdByName.get(event.service)!,
    issueId: issueIdByFingerprint.get(event.fingerprint)!,
    severity: event.severity,
    category: event.category,
    message: event.message,
    stackTrace: event.stackTrace ?? null,
    metadata: event.metadata as object,
    fingerprint: event.fingerprint,
    createdAt: at,
  }));

  const CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    await prisma.runtimeEvent.createMany({ data: batch });
    inserted += batch.length;
    console.log(`[backfill] inserted ${inserted}/${rows.length} events`);
  }

  // Deployments aren't part of the event stream, so generate a fresh batch for
  // every touched service to keep the Deployment Frequency chart populated.
  const deployments = generateDeployments(serviceIdByName.keys(), days, now);
  if (deployments.length > 0) {
    await prisma.deployment.createMany({
      data: deployments.map((d) => ({
        serviceId: serviceIdByName.get(d.service)!,
        version: d.version,
        commitSha: d.commitSha,
        environment: d.environment,
        deployedAt: d.deployedAt,
      })),
    });
  }

  console.log(
    `[backfill] done — ${rows.length} events across ${byFingerprint.size} issues and ${serviceIdByName.size} services, plus ${deployments.length} deployments.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
