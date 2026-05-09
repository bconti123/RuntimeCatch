/**
 * Continuously generates realistic runtime events into the database.
 *
 *   npm run simulate              # every 2-5s, runs forever
 *   SIMULATE_INTERVAL_MS=500 npm run simulate
 *   SIMULATE_DURATION_MS=30000 npm run simulate   # auto-exit after 30s
 *
 * Writes directly via Prisma (no HTTP) so it works without the dev server.
 * To exercise the ingestion API instead, see the curl examples in README.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type EventCategory,
  type Severity,
} from "../prisma/generated/client/client";
import { computeFingerprint, deriveIssueTitle } from "../lib/fingerprint";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type Scenario = {
  service: string;
  severity: Severity;
  category: EventCategory;
  message: string;
  stackTrace?: string;
  metadata: Record<string, unknown>;
  weight: number;
};

const SCENARIOS: Scenario[] = [
  {
    service: "playback-service",
    severity: "CRITICAL",
    category: "PLAYBACK_ERROR",
    message: "DRM license timeout while starting playback",
    stackTrace: [
      "DrmLicenseTimeoutError: license server did not respond",
      "    at DrmClient.fetchLicense (/app/src/playback/drm.ts:54:11)",
      "    at PlaybackSession.start (/app/src/playback/session.ts:88:18)",
    ].join("\n"),
    metadata: { region: "us-west", device: "smart-tv", licenseServer: "widevine" },
    weight: 4,
  },
  {
    service: "playback-service",
    severity: "ERROR",
    category: "PLAYBACK_ERROR",
    message: "Buffer underrun: ABR ladder exhausted",
    metadata: { networkClass: "cellular-3g", region: "ap-south-1" },
    weight: 5,
  },
  {
    service: "video-streaming-api",
    severity: "WARNING",
    category: "API_LATENCY",
    message: "P99 latency above SLO on GET /v1/streams",
    metadata: {
      route: "GET /v1/streams",
      p99Ms: 2400 + Math.floor(Math.random() * 800),
      sloMs: 1000,
    },
    weight: 6,
  },
  {
    service: "video-streaming-api",
    severity: "ERROR",
    category: "API_LATENCY",
    message: "Upstream timeout fetching manifest from origin",
    metadata: { upstream: "origin.internal:9090", timeoutMs: 5000 },
    weight: 3,
  },
  {
    service: "video-streaming-api",
    severity: "CRITICAL",
    category: "DEPLOYMENT",
    message: "Module not found: '@/lib/featureFlags' after deploy",
    stackTrace: [
      "Error: Cannot find module '@/lib/featureFlags'",
      "    at handler (/app/.next/server/app/v1/streams/route.js:42:11)",
    ].join("\n"),
    metadata: { deployVersion: "v2.14.3", regressionFrom: "v2.14.2" },
    weight: 2,
  },
  {
    service: "payments-api",
    severity: "ERROR",
    category: "DATABASE",
    message: "Timed out fetching connection from the pool",
    stackTrace: [
      "PrismaClientKnownRequestError: connection pool exhausted",
      "    at ChargeService.createCharge (/app/src/payments/charge.ts:62:14)",
    ].join("\n"),
    metadata: { poolMax: 20, queueDepth: 30 + Math.floor(Math.random() * 30) },
    weight: 3,
  },
  {
    service: "auth-service",
    severity: "WARNING",
    category: "AUTH",
    message: "JWT signature mismatch on access token",
    metadata: { issuer: "auth0", clockSkewSeconds: 30 },
    weight: 4,
  },
  {
    service: "recommendations-engine",
    severity: "ERROR",
    category: "NETWORK",
    message: "FetchError: 502 Bad Gateway from recs.internal:8080/v1/rank",
    metadata: { retries: 3, upstream: "recs.internal:8080" },
    weight: 4,
  },
  {
    service: "web-frontend",
    severity: "ERROR",
    category: "RUNTIME_ERROR",
    message: "ChunkLoadError: Loading chunk main failed",
    stackTrace: [
      "ChunkLoadError: Loading chunk main failed.",
      "    at __webpack_require__.f.j (webpack/runtime/load script:67:35)",
    ].join("\n"),
    metadata: { staleClients: 5 + Math.floor(Math.random() * 50) },
    weight: 3,
  },
  {
    service: "web-frontend",
    severity: "INFO",
    category: "RUNTIME_ERROR",
    message: "Unhandled promise rejection in client",
    metadata: { route: "/dashboard" },
    weight: 2,
  },
];

const TOTAL_WEIGHT = SCENARIOS.reduce((s, x) => s + x.weight, 0);

function pickScenario(): Scenario {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const s of SCENARIOS) {
    if ((r -= s.weight) <= 0) return s;
  }
  return SCENARIOS[0];
}

const SEVERITY_RANK: Record<Severity, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
};

async function ingest(scenario: Scenario, occurredAt: Date) {
  const service = await prisma.service.findFirst({
    where: { name: scenario.service },
  });
  if (!service) {
    console.warn(
      `[simulate] skipping unknown service '${scenario.service}' — did you run the seed?`
    );
    return;
  }

  const fingerprint = computeFingerprint({
    serviceName: service.name,
    category: scenario.category,
    message: scenario.message,
    stackTrace: scenario.stackTrace,
  });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.issue.findUnique({ where: { fingerprint } });
    const promotedSeverity =
      existing && SEVERITY_RANK[existing.severity] > SEVERITY_RANK[scenario.severity]
        ? existing.severity
        : scenario.severity;

    const issue = await tx.issue.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        title: deriveIssueTitle(scenario.message),
        severity: scenario.severity,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
        occurrenceCount: 1,
      },
      update: {
        lastSeenAt: occurredAt,
        occurrenceCount: { increment: 1 },
        severity: promotedSeverity,
        status: "OPEN",
      },
    });

    await tx.runtimeEvent.create({
      data: {
        serviceId: service.id,
        issueId: issue.id,
        severity: scenario.severity,
        category: scenario.category,
        message: scenario.message,
        stackTrace: scenario.stackTrace ?? null,
        metadata: scenario.metadata as object,
        fingerprint,
        createdAt: occurredAt,
      },
    });
  });

  console.log(
    `[simulate] ${scenario.service.padEnd(24)} ${scenario.severity.padEnd(8)} ${scenario.category.padEnd(16)} ${scenario.message}`
  );
}

async function main() {
  const intervalMs = Number(process.env.SIMULATE_INTERVAL_MS ?? 0);
  const durationMs = Number(process.env.SIMULATE_DURATION_MS ?? 0);
  const startedAt = Date.now();

  console.log(
    `[simulate] streaming events${
      intervalMs > 0 ? ` every ${intervalMs}ms` : " every 2-5s (jittered)"
    }${durationMs > 0 ? `, stopping after ${durationMs}ms` : ", press Ctrl+C to stop"}`
  );

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    console.log("\n[simulate] stopping…");
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    if (durationMs > 0 && Date.now() - startedAt >= durationMs) break;
    const scenario = pickScenario();
    try {
      await ingest(scenario, new Date());
    } catch (err) {
      console.error("[simulate] failed to ingest event:", err);
    }
    const wait =
      intervalMs > 0 ? intervalMs : 2000 + Math.floor(Math.random() * 3000);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
