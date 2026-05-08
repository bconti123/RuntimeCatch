import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  AlertStatus,
  Environment,
  EventCategory,
  IssueStatus,
  Role,
  ServiceStatus,
  Severity,
} from "./generated/client/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Did you create .env?");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const NOW = Date.now();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60_000);
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60_000);

async function main() {
  console.log("Resetting observability tables…");
  await prisma.runtimeEvent.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding users…");
  const [owner, engineer, oncall] = await Promise.all([
    prisma.user.create({
      data: {
        email: "owner@runtimecatch.dev",
        name: "Avery Chen",
        role: Role.OWNER,
      },
    }),
    prisma.user.create({
      data: {
        email: "jordan@runtimecatch.dev",
        name: "Jordan Park",
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: "sam@runtimecatch.dev",
        name: "Sam Rivera",
        role: Role.USER,
      },
    }),
  ]);

  console.log("Seeding services…");
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "video-streaming-api",
        environment: Environment.PRODUCTION,
        status: ServiceStatus.DEGRADED,
      },
    }),
    prisma.service.create({
      data: {
        name: "playback-service",
        environment: Environment.PRODUCTION,
        status: ServiceStatus.DOWN,
      },
    }),
    prisma.service.create({
      data: {
        name: "auth-service",
        environment: Environment.PRODUCTION,
        status: ServiceStatus.HEALTHY,
      },
    }),
    prisma.service.create({
      data: {
        name: "payments-api",
        environment: Environment.PRODUCTION,
        status: ServiceStatus.HEALTHY,
      },
    }),
    prisma.service.create({
      data: {
        name: "recommendations-engine",
        environment: Environment.STAGING,
        status: ServiceStatus.DEGRADED,
      },
    }),
    prisma.service.create({
      data: {
        name: "web-frontend",
        environment: Environment.PRODUCTION,
        status: ServiceStatus.HEALTHY,
      },
    }),
  ]);

  const byName = Object.fromEntries(services.map((s) => [s.name, s]));

  console.log("Seeding deployments…");
  await prisma.deployment.createMany({
    data: [
      {
        serviceId: byName["video-streaming-api"].id,
        version: "v2.14.3",
        commitSha: "a1f9c3e",
        environment: Environment.PRODUCTION,
        deployedAt: hoursAgo(2),
      },
      {
        serviceId: byName["video-streaming-api"].id,
        version: "v2.14.2",
        commitSha: "3d2e8b7",
        environment: Environment.PRODUCTION,
        deployedAt: daysAgo(1),
      },
      {
        serviceId: byName["playback-service"].id,
        version: "v1.7.0",
        commitSha: "9c44a01",
        environment: Environment.PRODUCTION,
        deployedAt: hoursAgo(1),
      },
      {
        serviceId: byName["auth-service"].id,
        version: "v3.2.1",
        commitSha: "f01b2da",
        environment: Environment.PRODUCTION,
        deployedAt: daysAgo(3),
      },
      {
        serviceId: byName["payments-api"].id,
        version: "v4.0.5",
        commitSha: "8b7c5f2",
        environment: Environment.PRODUCTION,
        deployedAt: daysAgo(2),
      },
      {
        serviceId: byName["recommendations-engine"].id,
        version: "v0.9.0-rc.4",
        commitSha: "5e6d4c3",
        environment: Environment.STAGING,
        deployedAt: hoursAgo(6),
      },
      {
        serviceId: byName["web-frontend"].id,
        version: "v6.11.0",
        commitSha: "c0ffee1",
        environment: Environment.PRODUCTION,
        deployedAt: hoursAgo(8),
      },
    ],
  });

  console.log("Seeding issues + runtime events…");

  type IssueSeed = {
    title: string;
    fingerprint: string;
    severity: Severity;
    category: EventCategory;
    status?: IssueStatus;
    serviceName: keyof typeof byName;
    message: string;
    stackTrace?: string;
    metadata: Record<string, unknown>;
    occurrences: Array<{ at: Date; resolved?: boolean }>;
  };

  const issueSeeds: IssueSeed[] = [
    {
      title: "TypeError: cannot read properties of undefined (reading 'manifest')",
      fingerprint: "playback-service:TypeError:manifest",
      severity: Severity.CRITICAL,
      category: EventCategory.PLAYBACK_ERROR,
      serviceName: "playback-service",
      message:
        "TypeError: Cannot read properties of undefined (reading 'manifest')",
      stackTrace: [
        "TypeError: Cannot read properties of undefined (reading 'manifest')",
        "    at PlaybackSession.loadManifest (/app/src/playback/session.ts:142:21)",
        "    at PlaybackSession.start (/app/src/playback/session.ts:88:18)",
        "    at async StreamHandler.handle (/app/src/handlers/stream.ts:54:5)",
      ].join("\n"),
      metadata: {
        userAgent: "Mozilla/5.0 RuntimeCatchPlayer/1.4",
        deviceClass: "smart-tv",
        bitrateKbps: 6000,
        cdn: "akamai",
      },
      occurrences: [
        { at: minutesAgo(2) },
        { at: minutesAgo(7) },
        { at: minutesAgo(15) },
        { at: minutesAgo(31) },
        { at: minutesAgo(58) },
        { at: hoursAgo(2) },
      ],
    },
    {
      title: "Buffer underrun: ABR ladder exhausted",
      fingerprint: "playback-service:BufferUnderrun:ABR",
      severity: Severity.ERROR,
      category: EventCategory.PLAYBACK_ERROR,
      serviceName: "playback-service",
      message: "BufferUnderrunError: ABR ladder exhausted, dropped to 240p",
      stackTrace: [
        "BufferUnderrunError: ABR ladder exhausted",
        "    at AbrController.selectBitrate (/app/src/playback/abr.ts:73:11)",
        "    at PlaybackSession.tick (/app/src/playback/session.ts:201:24)",
      ].join("\n"),
      metadata: { region: "us-west-2", networkClass: "cellular-3g" },
      occurrences: [
        { at: minutesAgo(4) },
        { at: minutesAgo(22) },
        { at: hoursAgo(1) },
        { at: hoursAgo(3) },
      ],
    },
    {
      title: "P99 latency above SLO on /v1/streams",
      fingerprint: "video-streaming-api:latency:streams-p99",
      severity: Severity.WARNING,
      category: EventCategory.API_LATENCY,
      serviceName: "video-streaming-api",
      message: "P99 latency 2,840ms exceeds SLO (1,000ms) on GET /v1/streams",
      metadata: {
        route: "GET /v1/streams",
        p50Ms: 220,
        p95Ms: 1480,
        p99Ms: 2840,
        sloMs: 1000,
        windowMinutes: 5,
      },
      occurrences: [
        { at: minutesAgo(6) },
        { at: minutesAgo(11) },
        { at: minutesAgo(28) },
        { at: hoursAgo(1) },
        { at: hoursAgo(2) },
      ],
    },
    {
      title: "Module not found: '@/lib/featureFlags' after deploy v2.14.3",
      fingerprint: "video-streaming-api:ModuleNotFound:featureFlags",
      severity: Severity.CRITICAL,
      category: EventCategory.DEPLOYMENT,
      serviceName: "video-streaming-api",
      message:
        "Error: Cannot find module '@/lib/featureFlags' (regression introduced in v2.14.3)",
      stackTrace: [
        "Error: Cannot find module '@/lib/featureFlags'",
        "    at Object.require (/app/.next/server/chunks/streams.js:1:842)",
        "    at handler (/app/.next/server/app/v1/streams/route.js:42:11)",
      ].join("\n"),
      metadata: {
        deployVersion: "v2.14.3",
        commitSha: "a1f9c3e",
        regressionFrom: "v2.14.2",
      },
      occurrences: [
        { at: minutesAgo(3) },
        { at: minutesAgo(9) },
        { at: minutesAgo(18) },
        { at: minutesAgo(45) },
      ],
    },
    {
      title: "Connection pool exhausted on payments db",
      fingerprint: "payments-api:db:pool-exhausted",
      severity: Severity.ERROR,
      category: EventCategory.DATABASE,
      serviceName: "payments-api",
      message:
        "PrismaClientKnownRequestError: timed out waiting for a connection from the pool",
      stackTrace: [
        "PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool",
        "    at ChargeService.createCharge (/app/src/payments/charge.ts:62:14)",
        "    at async POST (/app/src/app/api/v1/charges/route.ts:21:5)",
      ].join("\n"),
      metadata: { poolMax: 20, queueDepth: 47, timeoutMs: 5000 },
      occurrences: [
        { at: minutesAgo(12) },
        { at: minutesAgo(34) },
        { at: hoursAgo(2) },
      ],
    },
    {
      title: "401 Unauthorized: token signature mismatch",
      fingerprint: "auth-service:jwt:signature-mismatch",
      severity: Severity.WARNING,
      category: EventCategory.AUTH,
      serviceName: "auth-service",
      status: IssueStatus.MUTED,
      message: "JsonWebTokenError: invalid signature on access token",
      stackTrace: [
        "JsonWebTokenError: invalid signature",
        "    at verifyJWT (/app/src/auth/jwt.ts:34:13)",
        "    at authenticate (/app/src/middleware/auth.ts:17:9)",
      ].join("\n"),
      metadata: { issuer: "auth0", clockSkewSeconds: 30 },
      occurrences: [
        { at: hoursAgo(4) },
        { at: hoursAgo(7) },
        { at: daysAgo(1) },
      ],
    },
    {
      title: "Upstream 502 from recommendations-engine",
      fingerprint: "recommendations-engine:upstream:502",
      severity: Severity.ERROR,
      category: EventCategory.NETWORK,
      serviceName: "recommendations-engine",
      message: "FetchError: 502 Bad Gateway from recs.internal:8080/v1/rank",
      metadata: { retries: 3, upstream: "recs.internal:8080" },
      occurrences: [
        { at: minutesAgo(20) },
        { at: minutesAgo(55) },
        { at: hoursAgo(3) },
      ],
    },
    {
      title: "ChunkLoadError: failed to fetch /_next/static/chunks/main.js",
      fingerprint: "web-frontend:ChunkLoadError:main",
      severity: Severity.ERROR,
      category: EventCategory.RUNTIME_ERROR,
      serviceName: "web-frontend",
      status: IssueStatus.RESOLVED,
      message:
        "ChunkLoadError: Loading chunk main failed (after deploy v6.11.0)",
      stackTrace: [
        "ChunkLoadError: Loading chunk main failed.",
        "    at __webpack_require__.f.j (webpack/runtime/load script:67:35)",
      ].join("\n"),
      metadata: { deployVersion: "v6.11.0", staleClients: 38 },
      occurrences: [
        { at: hoursAgo(7), resolved: true },
        { at: hoursAgo(8), resolved: true },
      ],
    },
  ];

  for (const seed of issueSeeds) {
    const sortedTimes = seed.occurrences
      .map((o) => o.at)
      .sort((a, b) => a.getTime() - b.getTime());
    const firstSeenAt = sortedTimes[0];
    const lastSeenAt = sortedTimes[sortedTimes.length - 1];

    const issue = await prisma.issue.create({
      data: {
        title: seed.title,
        fingerprint: seed.fingerprint,
        severity: seed.severity,
        status: seed.status ?? IssueStatus.OPEN,
        occurrenceCount: seed.occurrences.length,
        firstSeenAt,
        lastSeenAt,
      },
    });

    await prisma.runtimeEvent.createMany({
      data: seed.occurrences.map((occ) => ({
        serviceId: byName[seed.serviceName].id,
        issueId: issue.id,
        severity: seed.severity,
        category: seed.category,
        message: seed.message,
        stackTrace: seed.stackTrace,
        metadata: seed.metadata as object,
        fingerprint: seed.fingerprint,
        resolved: occ.resolved ?? false,
        createdAt: occ.at,
      })),
    });
  }

  console.log("Seeding alerts…");
  await prisma.alert.createMany({
    data: [
      {
        serviceId: byName["playback-service"].id,
        title: "Playback error rate > 5% over 5m",
        severity: Severity.CRITICAL,
        status: AlertStatus.TRIGGERED,
        triggeredAt: minutesAgo(8),
      },
      {
        serviceId: byName["video-streaming-api"].id,
        title: "P99 latency above SLO on /v1/streams",
        severity: Severity.WARNING,
        status: AlertStatus.ACKNOWLEDGED,
        triggeredAt: minutesAgo(35),
      },
      {
        serviceId: byName["video-streaming-api"].id,
        title: "Deploy v2.14.3 introduced ModuleNotFound regression",
        severity: Severity.CRITICAL,
        status: AlertStatus.TRIGGERED,
        triggeredAt: hoursAgo(2),
      },
      {
        serviceId: byName["payments-api"].id,
        title: "DB connection pool saturated",
        severity: Severity.ERROR,
        status: AlertStatus.RESOLVED,
        triggeredAt: hoursAgo(2),
        resolvedAt: minutesAgo(40),
      },
      {
        serviceId: byName["recommendations-engine"].id,
        title: "Upstream 502 rate above 1%",
        severity: Severity.ERROR,
        status: AlertStatus.TRIGGERED,
        triggeredAt: minutesAgo(22),
      },
    ],
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.service.count(),
    prisma.deployment.count(),
    prisma.issue.count(),
    prisma.runtimeEvent.count(),
    prisma.alert.count(),
  ]);

  console.log(
    [
      "Seed complete:",
      `  users: ${counts[0]} (owner=${owner.email}, admin=${engineer.email}, user=${oncall.email})`,
      `  services: ${counts[1]}`,
      `  deployments: ${counts[2]}`,
      `  issues: ${counts[3]}`,
      `  runtime events: ${counts[4]}`,
      `  alerts: ${counts[5]}`,
    ].join("\n")
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
