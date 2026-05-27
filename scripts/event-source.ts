/**
 * Shared event generation used by both the live streamer (simulate-events.ts)
 * and the one-shot backfill (simulate-backfill.ts).
 *
 * The scenario pool spans every EventCategory and Severity. Each scenario is a
 * template: a {token} in the *message* is filled from a small bounded pool
 * (region, route, device, …) so one scenario fans out into a handful of
 * related-but-distinct issues. Tokens that only live in `metadata` don't
 * affect the fingerprint, so they add realism without fragmenting grouping.
 * Scenarios that carry a stackTrace group by their first stack frame, so they
 * stay a single recurring issue (a real crash) no matter the message.
 */
import {
  type PrismaClient,
  type EventCategory,
  type Severity,
  Environment,
  ServiceStatus,
} from "../prisma/generated/client/client";
import { computeFingerprint, deriveIssueTitle } from "../lib/fingerprint";

// ---------------------------------------------------------------------------
// Bounded variation pools. Keeping these small keeps the number of distinct
// issues realistic instead of spawning a unique issue per event.
// ---------------------------------------------------------------------------
const POOLS = {
  region: [
    "us-west-2",
    "us-east-1",
    "eu-central-1",
    "eu-west-1",
    "ap-south-1",
    "ap-northeast-1",
    "sa-east-1",
  ],
  device: ["smart-tv", "ios", "android", "web", "roku", "fire-tv", "chromecast"],
  route: [
    "GET /v1/streams",
    "GET /v1/streams/manifest",
    "POST /v1/streams",
    "GET /v1/titles",
    "GET /v1/search",
    "GET /v1/recommendations",
    "POST /v1/playback/heartbeat",
  ],
  network: ["cellular-3g", "cellular-4g", "wifi", "ethernet"],
  upstream: [
    "origin.internal:9090",
    "recs.internal:8080",
    "cdn-edge.internal:443",
    "search.internal:7000",
    "billing.internal:5400",
  ],
  table: ["charges", "invoices", "subscriptions", "ledger", "customers"],
} as const;

type Vars = Record<string, string>;

export function sample<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rint(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildVars(): Vars {
  const v: Vars = {};
  for (const [key, values] of Object.entries(POOLS)) v[key] = sample(values);
  return v;
}

function fill(template: string, v: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);
}

// ---------------------------------------------------------------------------
// Service registry. Names not in the seed are lazily created (see
// makeServiceResolver) so we can add APIs without re-seeding the database.
// ---------------------------------------------------------------------------
const SERVICE_ENV: Record<string, Environment> = {
  "video-streaming-api": Environment.PRODUCTION,
  "playback-service": Environment.PRODUCTION,
  "auth-service": Environment.PRODUCTION,
  "payments-api": Environment.PRODUCTION,
  "recommendations-engine": Environment.STAGING,
  "web-frontend": Environment.PRODUCTION,
  // new services, auto-created on first use:
  "search-service": Environment.PRODUCTION,
  "cdn-edge": Environment.PRODUCTION,
  "billing-worker": Environment.PRODUCTION,
  "notifications-service": Environment.PRODUCTION,
};

// ---------------------------------------------------------------------------
// Scenario templates.
// ---------------------------------------------------------------------------
type ScenarioTemplate = {
  service: string;
  severity: Severity | Severity[];
  category: EventCategory;
  message: string;
  stackTrace?: string;
  metadata?: (v: Vars) => Record<string, unknown>;
  weight: number;
};

const SCENARIOS: ScenarioTemplate[] = [
  // ---- PLAYBACK_ERROR -----------------------------------------------------
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
    metadata: (v) => ({ region: v.region, device: v.device, licenseServer: "widevine" }),
    weight: 4,
  },
  {
    service: "playback-service",
    severity: "ERROR",
    category: "PLAYBACK_ERROR",
    message: "Buffer underrun on {device}: ABR ladder exhausted",
    metadata: (v) => ({ device: v.device, networkClass: v.network, region: v.region }),
    weight: 5,
  },
  {
    service: "playback-service",
    severity: "WARNING",
    category: "PLAYBACK_ERROR",
    message: "Subtitle track failed to load in {region}",
    metadata: (v) => ({ region: v.region, lang: sample(["en", "es", "fr", "de"]) }),
    weight: 3,
  },
  // ---- API_LATENCY --------------------------------------------------------
  {
    service: "video-streaming-api",
    severity: "WARNING",
    category: "API_LATENCY",
    message: "P99 latency above SLO on {route}",
    metadata: (v) => ({ route: v.route, p99Ms: rint(1200, 3200), sloMs: 1000 }),
    weight: 6,
  },
  {
    service: "video-streaming-api",
    severity: "ERROR",
    category: "API_LATENCY",
    message: "Upstream timeout fetching manifest from {upstream}",
    metadata: (v) => ({ upstream: v.upstream, timeoutMs: 5000 }),
    weight: 3,
  },
  {
    service: "search-service",
    severity: "WARNING",
    category: "API_LATENCY",
    message: "Slow query budget exceeded on {route}",
    metadata: (v) => ({ route: v.route, tookMs: rint(800, 2600) }),
    weight: 3,
  },
  // ---- DEPLOYMENT ---------------------------------------------------------
  {
    service: "video-streaming-api",
    severity: "CRITICAL",
    category: "DEPLOYMENT",
    message: "Module not found: '@/lib/featureFlags' after deploy",
    stackTrace: [
      "Error: Cannot find module '@/lib/featureFlags'",
      "    at handler (/app/.next/server/app/v1/streams/route.js:42:11)",
    ].join("\n"),
    metadata: () => ({ deployVersion: "v2.14.3", regressionFrom: "v2.14.2" }),
    weight: 2,
  },
  {
    service: "video-streaming-api",
    severity: "INFO",
    category: "DEPLOYMENT",
    message: "Rolling release advanced in {region}",
    metadata: (v) => ({ region: v.region, percent: sample(["10", "25", "50", "100"]) }),
    weight: 2,
  },
  {
    service: "web-frontend",
    severity: "ERROR",
    category: "DEPLOYMENT",
    message: "Post-deploy health check failed on {route}",
    metadata: (v) => ({ route: v.route, statusCode: sample(["500", "502", "503"]) }),
    weight: 2,
  },
  // ---- DATABASE -----------------------------------------------------------
  {
    service: "payments-api",
    severity: "ERROR",
    category: "DATABASE",
    message: "Timed out fetching connection from the pool",
    stackTrace: [
      "PrismaClientKnownRequestError: connection pool exhausted",
      "    at ChargeService.createCharge (/app/src/payments/charge.ts:62:14)",
    ].join("\n"),
    metadata: () => ({ poolMax: 20, queueDepth: rint(25, 60) }),
    weight: 3,
  },
  {
    service: "billing-worker",
    severity: "WARNING",
    category: "DATABASE",
    message: "Slow query > 1s on table {table}",
    metadata: (v) => ({ table: v.table, tookMs: rint(1000, 4000), rows: rint(1, 50000) }),
    weight: 3,
  },
  {
    service: "billing-worker",
    severity: "CRITICAL",
    category: "DATABASE",
    message: "Deadlock detected on table {table}",
    metadata: (v) => ({ table: v.table, victims: rint(1, 4) }),
    weight: 1,
  },
  // ---- NETWORK ------------------------------------------------------------
  {
    service: "recommendations-engine",
    severity: "ERROR",
    category: "NETWORK",
    message: "FetchError: 502 Bad Gateway from {upstream}",
    metadata: (v) => ({ upstream: v.upstream, retries: rint(1, 5) }),
    weight: 4,
  },
  {
    service: "cdn-edge",
    severity: "WARNING",
    category: "NETWORK",
    message: "Elevated retry rate to {upstream}",
    metadata: (v) => ({ upstream: v.upstream, retryRate: rint(5, 40) / 100 }),
    weight: 3,
  },
  {
    service: "cdn-edge",
    severity: "ERROR",
    category: "NETWORK",
    message: "TLS handshake failed with {upstream}",
    metadata: (v) => ({ upstream: v.upstream, cipher: "TLS_AES_128_GCM_SHA256" }),
    weight: 2,
  },
  // ---- AUTH ---------------------------------------------------------------
  {
    service: "auth-service",
    severity: "WARNING",
    category: "AUTH",
    message: "JWT signature mismatch on access token",
    metadata: () => ({ issuer: "auth0", clockSkewSeconds: 30 }),
    weight: 4,
  },
  {
    service: "auth-service",
    severity: "ERROR",
    category: "AUTH",
    message: "Token refresh failed in {region}",
    metadata: (v) => ({ region: v.region, grant: "refresh_token" }),
    weight: 3,
  },
  {
    service: "auth-service",
    severity: "INFO",
    category: "AUTH",
    message: "Login rate limit triggered from {region}",
    metadata: (v) => ({ region: v.region, attempts: rint(20, 200) }),
    weight: 2,
  },
  // ---- RUNTIME_ERROR ------------------------------------------------------
  {
    service: "web-frontend",
    severity: "ERROR",
    category: "RUNTIME_ERROR",
    message: "ChunkLoadError: Loading chunk main failed",
    stackTrace: [
      "ChunkLoadError: Loading chunk main failed.",
      "    at __webpack_require__.f.j (webpack/runtime/load script:67:35)",
    ].join("\n"),
    metadata: () => ({ staleClients: rint(5, 60) }),
    weight: 3,
  },
  {
    service: "web-frontend",
    severity: "INFO",
    category: "RUNTIME_ERROR",
    message: "Unhandled promise rejection on {route}",
    metadata: (v) => ({ route: v.route }),
    weight: 2,
  },
  {
    service: "web-frontend",
    severity: "ERROR",
    category: "RUNTIME_ERROR",
    message: "TypeError: cannot read properties of undefined on {route}",
    metadata: (v) => ({ route: v.route, prop: sample(["title", "id", "url", "duration"]) }),
    weight: 3,
  },
  // ---- APP_EVENT ----------------------------------------------------------
  {
    service: "playback-service",
    severity: "INFO",
    category: "APP_EVENT",
    message: "Playback session started on {device}",
    metadata: (v) => ({ device: v.device, region: v.region }),
    weight: 3,
  },
  {
    service: "payments-api",
    severity: "INFO",
    category: "APP_EVENT",
    message: "Checkout completed in {region}",
    metadata: (v) => ({ region: v.region, amountCents: rint(499, 4999) }),
    weight: 2,
  },
  {
    service: "notifications-service",
    severity: "INFO",
    category: "APP_EVENT",
    message: "Push notification batch delivered to {region}",
    metadata: (v) => ({ region: v.region, batchSize: rint(50, 5000) }),
    weight: 2,
  },
  // ---- DEBUG --------------------------------------------------------------
  {
    service: "search-service",
    severity: "DEBUG",
    category: "APP_EVENT",
    message: "Cache warm completed for {route}",
    metadata: (v) => ({ route: v.route, keys: rint(100, 10000) }),
    weight: 2,
  },
  {
    service: "cdn-edge",
    severity: "DEBUG",
    category: "NETWORK",
    message: "Connection pool resized for {upstream}",
    metadata: (v) => ({ upstream: v.upstream, size: rint(8, 64) }),
    weight: 1,
  },
];

const TOTAL_WEIGHT = SCENARIOS.reduce((s, x) => s + x.weight, 0);

function pickScenario(): ScenarioTemplate {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const s of SCENARIOS) {
    if ((r -= s.weight) <= 0) return s;
  }
  return SCENARIOS[0];
}

export type RenderedEvent = {
  service: string;
  severity: Severity;
  category: EventCategory;
  message: string;
  stackTrace?: string;
  metadata: Record<string, unknown>;
  fingerprint: string;
};

/** Pick (or take) a scenario and resolve its template tokens into a concrete event. */
export function renderEvent(scenario: ScenarioTemplate = pickScenario()): RenderedEvent {
  const v = buildVars();
  const severity = Array.isArray(scenario.severity)
    ? sample(scenario.severity)
    : scenario.severity;
  const message = fill(scenario.message, v);
  const stackTrace = scenario.stackTrace ? fill(scenario.stackTrace, v) : undefined;
  const fingerprint = computeFingerprint({
    serviceName: scenario.service,
    category: scenario.category,
    message,
    stackTrace,
  });
  return {
    service: scenario.service,
    severity,
    category: scenario.category,
    message,
    stackTrace,
    metadata: scenario.metadata ? scenario.metadata(v) : {},
    fingerprint,
  };
}

// ---------------------------------------------------------------------------
// Database helpers.
// ---------------------------------------------------------------------------
const SEVERITY_RANK: Record<Severity, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
};

/** Find the demo project, or fall back to the first project in the database. */
export async function resolveProject(prisma: PrismaClient) {
  const bySlug = await prisma.project.findFirst({
    where: { slug: "runtimecatch-demo" },
  });
  if (bySlug) return bySlug;
  const first = await prisma.project.findFirst();
  if (!first) {
    throw new Error("No project found — run `npm run db:seed` first.");
  }
  return first;
}

/**
 * Returns a memoized resolver that finds a service by name, lazily creating it
 * under the given project if it doesn't exist yet (no re-seed required).
 */
export function makeServiceResolver(prisma: PrismaClient, projectId: string) {
  const cache = new Map<string, { id: string; name: string }>();
  return async (name: string) => {
    const cached = cache.get(name);
    if (cached) return cached;
    const service = await prisma.service.upsert({
      where: { projectId_name: { projectId, name } },
      create: {
        projectId,
        name,
        environment: SERVICE_ENV[name] ?? Environment.PRODUCTION,
        status: ServiceStatus.HEALTHY,
      },
      update: {},
      select: { id: true, name: true },
    });
    cache.set(name, service);
    return service;
  };
}

type ServiceResolver = ReturnType<typeof makeServiceResolver>;

/**
 * Upsert the issue for this event (grouping by fingerprint) and append the
 * runtime event. lastSeen/firstSeen are clamped so out-of-order timestamps
 * (e.g. from the backfill) never move an issue's window the wrong way.
 */
export async function ingestEvent(
  prisma: PrismaClient,
  resolveService: ServiceResolver,
  event: RenderedEvent,
  occurredAt: Date
) {
  const service = await resolveService(event.service);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.issue.findUnique({
      where: { fingerprint: event.fingerprint },
    });

    const promotedSeverity =
      existing && SEVERITY_RANK[existing.severity] > SEVERITY_RANK[event.severity]
        ? existing.severity
        : event.severity;
    const lastSeenAt =
      existing && existing.lastSeenAt > occurredAt ? existing.lastSeenAt : occurredAt;

    const issue = await tx.issue.upsert({
      where: { fingerprint: event.fingerprint },
      create: {
        fingerprint: event.fingerprint,
        title: deriveIssueTitle(event.message),
        severity: event.severity,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
        occurrenceCount: 1,
      },
      update: {
        lastSeenAt,
        occurrenceCount: { increment: 1 },
        severity: promotedSeverity,
        status: "OPEN",
      },
    });

    await tx.runtimeEvent.create({
      data: {
        serviceId: service.id,
        issueId: issue.id,
        severity: event.severity,
        category: event.category,
        message: event.message,
        stackTrace: event.stackTrace ?? null,
        metadata: event.metadata as object,
        fingerprint: event.fingerprint,
        createdAt: occurredAt,
      },
    });
  });
}
