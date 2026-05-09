import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { EventsOverTimeChart } from "@/components/charts/EventsOverTimeChart";
import { CategoryBreakdownChart } from "@/components/charts/CategoryBreakdownChart";
import {
  AlertStatusBadge,
  CategoryBadge,
  EnvironmentBadge,
  ServiceStatusBadge,
  SeverityBadge,
} from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime, formatNumber, formatRelative, now } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Severity } from "@/prisma/generated/client/client";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) notFound();

  const since24h = new Date(now() - DAY_MS);

  const [
    events24h,
    criticalCount,
    deployments,
    recentEvents,
    alerts,
    issuesForService,
    severityCounts,
    categoryCounts,
    overTimeRaw,
  ] = await Promise.all([
    prisma.runtimeEvent.count({
      where: { serviceId: id, createdAt: { gte: since24h } },
    }),
    prisma.runtimeEvent.count({
      where: {
        serviceId: id,
        severity: "CRITICAL",
        createdAt: { gte: since24h },
      },
    }),
    prisma.deployment.findMany({
      where: { serviceId: id },
      orderBy: { deployedAt: "desc" },
      take: 10,
    }),
    prisma.runtimeEvent.findMany({
      where: { serviceId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { issue: { select: { id: true, title: true } } },
    }),
    prisma.alert.findMany({
      where: { serviceId: id },
      orderBy: { triggeredAt: "desc" },
      take: 8,
    }),
    prisma.issue.findMany({
      where: {
        events: { some: { serviceId: id } },
        status: "OPEN",
      },
      orderBy: { lastSeenAt: "desc" },
      take: 6,
    }),
    prisma.runtimeEvent.groupBy({
      by: ["severity"],
      where: { serviceId: id, createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.runtimeEvent.groupBy({
      by: ["category"],
      where: { serviceId: id, createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.runtimeEvent.findMany({
      where: { serviceId: id, createdAt: { gte: since24h } },
      select: { createdAt: true, severity: true },
    }),
  ]);

  const overTime = bucketHourly(overTimeRaw, 24);
  const categoryData = categoryCounts.map((c) => ({
    category: c.category,
    count: c._count._all,
  }));

  const severityTotal = severityCounts.reduce(
    (a, c) => a + c._count._all,
    0
  );
  const criticalShare =
    severityTotal === 0
      ? 0
      : Math.round((criticalCount / severityTotal) * 100);

  const lastDeploy = deployments[0];

  return (
    <>
      <PageHeader
        title={service.name}
        subtitle={`Service detail · environment: ${service.environment.toLowerCase()}`}
        breadcrumbs={[
          { label: "Services", href: "/services" },
          { label: service.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <EnvironmentBadge environment={service.environment} />
            <ServiceStatusBadge status={service.status} />
          </div>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Events (24h)"
            value={formatNumber(events24h)}
            hint="all severities"
          />
          <StatCard
            label="Critical (24h)"
            value={formatNumber(criticalCount)}
            hint={`${criticalShare}% of events`}
            tone={criticalCount > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Open issues"
            value={formatNumber(issuesForService.length)}
            hint="affecting this service"
            tone={issuesForService.length > 0 ? "warning" : "success"}
          />
          <StatCard
            label="Last deploy"
            value={lastDeploy ? lastDeploy.version : "—"}
            hint={
              lastDeploy
                ? `${formatRelative(lastDeploy.deployedAt)} · ${lastDeploy.commitSha.slice(0, 7)}`
                : "no deployments yet"
            }
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            title="Event timeline"
            subtitle="Hourly buckets, last 24h"
            className="lg:col-span-2"
          >
            <EventsOverTimeChart data={overTime} />
          </ChartCard>
          <ChartCard
            title="Category breakdown"
            subtitle="Last 24h"
          >
            <CategoryBreakdownChart data={categoryData} />
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                Recent runtime events
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Last 12 events on this service
              </p>
            </div>
            {recentEvents.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No runtime events"
                  description="This service is quiet. Events will land here as they're ingested."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {recentEvents.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-zinc-200">{e.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <span>{formatRelative(e.createdAt)}</span>
                          {e.issue ? (
                            <>
                              <span>·</span>
                              <Link
                                href={`/issues/${e.issue.id}`}
                                className="hover:text-emerald-300"
                              >
                                view issue
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <CategoryBadge category={e.category} />
                        <SeverityBadge severity={e.severity} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="border-b border-zinc-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-zinc-100">Alerts</h3>
              </div>
              {alerts.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No alerts" />
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {alerts.map((a) => (
                    <li key={a.id} className="px-5 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-zinc-200">{a.title}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            triggered {formatRelative(a.triggeredAt)}
                            {a.resolvedAt
                              ? ` · resolved ${formatRelative(a.resolvedAt)}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <SeverityBadge severity={a.severity} />
                          <AlertStatusBadge status={a.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="border-b border-zinc-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Recent deployments
                </h3>
              </div>
              {deployments.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No deployments" />
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {deployments.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between px-5 py-3 text-sm"
                    >
                      <div>
                        <div className="font-mono text-zinc-200">
                          {d.version}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          <span className="font-mono">
                            {d.commitSha.slice(0, 7)}
                          </span>
                          {" · "}
                          {formatDateTime(d.deployedAt)}
                        </div>
                      </div>
                      <EnvironmentBadge environment={d.environment} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function bucketHourly(
  events: Array<{ createdAt: Date; severity: Severity }>,
  hours: number
) {
  const buckets = new Map<
    string,
    { ts: number; total: number; critical: number }
  >();
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * HOUR_MS);
    d.setMinutes(0, 0, 0);
    buckets.set(d.toISOString(), { ts: d.getTime(), total: 0, critical: 0 });
  }
  for (const e of events) {
    const d = new Date(e.createdAt);
    d.setMinutes(0, 0, 0);
    const b = buckets.get(d.toISOString());
    if (!b) continue;
    b.total += 1;
    if (e.severity === "CRITICAL") b.critical += 1;
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}
