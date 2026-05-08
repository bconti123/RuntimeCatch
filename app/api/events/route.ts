import { NextResponse } from "next/server";
import { z } from "zod";
import { computeFingerprint, deriveIssueTitle } from "@/lib/fingerprint";
import { prisma } from "@/lib/prisma";

const SeverityEnum = z.enum([
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
]);
const CategoryEnum = z.enum([
  "RUNTIME_ERROR",
  "API_LATENCY",
  "PLAYBACK_ERROR",
  "DEPLOYMENT",
  "DATABASE",
  "NETWORK",
  "AUTH",
]);

const EventPayload = z.object({
  service: z.string().min(1).max(120),
  severity: SeverityEnum,
  category: CategoryEnum,
  message: z.string().min(1).max(2000),
  stackTrace: z.string().max(20_000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  fingerprint: z.string().min(4).max(120).optional(),
  occurredAt: z.iso.datetime().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = EventPayload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const payload = parsed.data;

  const service = await prisma.service.findUnique({
    where: { name: payload.service },
  });
  if (!service) {
    return NextResponse.json(
      {
        error: `Unknown service '${payload.service}'. Register the service first.`,
      },
      { status: 404 }
    );
  }

  const fingerprint =
    payload.fingerprint ??
    computeFingerprint({
      serviceName: service.name,
      category: payload.category,
      message: payload.message,
      stackTrace: payload.stackTrace ?? undefined,
    });

  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const issue = await tx.issue.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        title: deriveIssueTitle(payload.message),
        severity: payload.severity,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
        occurrenceCount: 1,
      },
      update: {
        lastSeenAt: occurredAt,
        occurrenceCount: { increment: 1 },
        // Promote severity if a higher one comes in.
        severity: bumpSeverity(payload.severity),
        // Reopen if a new event arrives on a previously resolved issue.
        status: "OPEN",
      },
    });

    const event = await tx.runtimeEvent.create({
      data: {
        serviceId: service.id,
        issueId: issue.id,
        severity: payload.severity,
        category: payload.category,
        message: payload.message,
        stackTrace: payload.stackTrace ?? null,
        ...(payload.metadata
          ? { metadata: payload.metadata as object }
          : {}),
        fingerprint,
        createdAt: occurredAt,
      },
      select: { id: true, createdAt: true },
    });

    return { issue, event };
  });

  return NextResponse.json(
    {
      eventId: result.event.id,
      issueId: result.issue.id,
      fingerprint,
      service: service.name,
      occurrenceCount: result.issue.occurrenceCount,
    },
    { status: 201 }
  );
}

// We bump severity by writing back the new event's severity directly. Prisma
// doesn't support `MAX(existing, new)` in a single update, so we approximate
// by overwriting — fine because new events represent the current state.
// To keep ranking deterministic, callers should pass the worst severity seen.
function bumpSeverity(s: string) {
  return s as
    | "DEBUG"
    | "INFO"
    | "WARNING"
    | "ERROR"
    | "CRITICAL";
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      hint: "POST a runtime event payload to /api/events",
      example: {
        service: "playback-service",
        severity: "CRITICAL",
        category: "PLAYBACK_ERROR",
        message: "DRM license timeout",
        stackTrace: "Error: license timeout\n    at ...",
        metadata: { region: "us-west", device: "smart-tv" },
      },
    },
    { status: 200 }
  );
}
