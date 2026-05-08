import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  EventCategory,
  Severity,
} from "@/prisma/generated/client/client";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function getDashboardStats() {
  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  const [
    events24h,
    openIssues,
    criticalAlerts,
    deployments7d,
    services,
    resolved7d,
  ] = await Promise.all([
    prisma.runtimeEvent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.issue.count({ where: { status: "OPEN" } }),
    prisma.alert.count({
      where: { severity: "CRITICAL", status: "TRIGGERED" },
    }),
    prisma.deployment.count({ where: { deployedAt: { gte: since7d } } }),
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, environment: true, status: true },
    }),
    prisma.issue.count({
      where: { status: "RESOLVED", lastSeenAt: { gte: since7d } },
    }),
  ]);

  const healthy = services.filter((s) => s.status === "HEALTHY").length;

  return {
    events24h,
    openIssues,
    criticalAlerts,
    deployments7d,
    resolved7d,
    services,
    healthyServices: healthy,
    totalServices: services.length,
  };
}

export async function getEventsOverTime(hours = 24) {
  const since = new Date(Date.now() - hours * HOUR_MS);
  const events = await prisma.runtimeEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, severity: true },
  });

  const buckets = new Map<string, { ts: number; total: number; critical: number }>();
  for (let i = hours - 1; i >= 0; i--) {
    const ts = bucketHour(Date.now() - i * HOUR_MS);
    buckets.set(ts.toISOString(), { ts: ts.getTime(), total: 0, critical: 0 });
  }
  for (const ev of events) {
    const ts = bucketHour(ev.createdAt.getTime()).toISOString();
    const b = buckets.get(ts);
    if (!b) continue;
    b.total += 1;
    if (ev.severity === "CRITICAL") b.critical += 1;
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

function bucketHour(ms: number) {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d;
}

export async function getSeverityDistribution() {
  const since24h = new Date(Date.now() - DAY_MS);
  const grouped = await prisma.runtimeEvent.groupBy({
    by: ["severity"],
    where: { createdAt: { gte: since24h } },
    _count: { _all: true },
  });
  const order: Severity[] = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];
  return order.map((sev) => ({
    severity: sev,
    count: grouped.find((g) => g.severity === sev)?._count._all ?? 0,
  }));
}

export async function getEventsByService(hours = 24) {
  const since = new Date(Date.now() - hours * HOUR_MS);
  const grouped = await prisma.runtimeEvent.groupBy({
    by: ["serviceId"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];
  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((g) => g.serviceId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(services.map((s) => [s.id, s.name]));
  return grouped
    .map((g) => ({
      service: nameById.get(g.serviceId) ?? "(unknown)",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getCategoryBreakdown() {
  const since24h = new Date(Date.now() - DAY_MS);
  const grouped = await prisma.runtimeEvent.groupBy({
    by: ["category"],
    where: { createdAt: { gte: since24h } },
    _count: { _all: true },
  });
  const order: EventCategory[] = [
    "RUNTIME_ERROR",
    "API_LATENCY",
    "PLAYBACK_ERROR",
    "DEPLOYMENT",
    "DATABASE",
    "NETWORK",
    "AUTH",
  ];
  return order
    .map((cat) => ({
      category: cat,
      count: grouped.find((g) => g.category === cat)?._count._all ?? 0,
    }))
    .filter((row) => row.count > 0);
}

export async function getDeploymentFrequency(days = 7) {
  const since = new Date(Date.now() - days * DAY_MS);
  const deps = await prisma.deployment.findMany({
    where: { deployedAt: { gte: since } },
    select: { deployedAt: true, environment: true },
  });

  const buckets = new Map<string, { day: string; prod: number; staging: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const day = bucketDay(Date.now() - i * DAY_MS);
    buckets.set(day.toISOString(), {
      day: day.toISOString(),
      prod: 0,
      staging: 0,
    });
  }
  for (const d of deps) {
    const key = bucketDay(d.deployedAt.getTime()).toISOString();
    const b = buckets.get(key);
    if (!b) continue;
    if (d.environment === "PRODUCTION") b.prod += 1;
    else if (d.environment === "STAGING") b.staging += 1;
  }
  return Array.from(buckets.values()).sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
  );
}

function bucketDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getRecentIssues(limit = 6) {
  return prisma.issue.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      severity: true,
      status: true,
      occurrenceCount: true,
      lastSeenAt: true,
      events: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { service: { select: { name: true } } },
      },
    },
  });
}
