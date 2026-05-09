import { NextResponse } from "next/server";
import { z } from "zod";
import { computeFingerprint, deriveIssueTitle } from "@/lib/fingerprint";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, touchApiKey } from "@/lib/api-keys";

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

function unauthorized(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
  );
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return unauthorized(
      "Missing or invalid API key. Send `Authorization: Bearer rc_live_…`."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
    where: {
      projectId_name: { projectId: auth.projectId, name: payload.service },
    },
  });
  if (!service) {
    return NextResponse.json(
      {
        error: `Unknown service '${payload.service}' in this project. Create it under /services/new first.`,
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

  const occurredAt = payload.occurredAt
    ? new Date(payload.occurredAt)
    : new Date();

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
        severity: payload.severity,
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

  // Fire-and-forget: refresh the key's lastUsedAt without blocking the response.
  void touchApiKey(auth.apiKeyId);

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

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      hint: "POST a runtime event payload to /api/events with `Authorization: Bearer rc_live_…`",
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
