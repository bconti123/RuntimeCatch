import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { EventsOverTimeChart } from "@/components/charts/EventsOverTimeChart";
import { SeverityDistributionChart } from "@/components/charts/SeverityDistributionChart";
import { EventsByServiceChart } from "@/components/charts/EventsByServiceChart";
import { CategoryBreakdownChart } from "@/components/charts/CategoryBreakdownChart";
import { DeploymentFrequencyChart } from "@/components/charts/DeploymentFrequencyChart";
import {
  ServiceStatusBadge,
  EnvironmentBadge,
  SeverityBadge,
  IssueStatusBadge,
} from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatNumber, formatRelative } from "@/lib/format";
import {
  getCategoryBreakdown,
  getDashboardStats,
  getDeploymentFrequency,
  getEventsByService,
  getEventsOverTime,
  getRecentIssues,
  getSeverityDistribution,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    stats,
    overTime,
    severity,
    byService,
    byCategory,
    deploymentFreq,
    recentIssues,
  ] = await Promise.all([
    getDashboardStats(),
    getEventsOverTime(24),
    getSeverityDistribution(),
    getEventsByService(24),
    getCategoryBreakdown(),
    getDeploymentFrequency(7),
    getRecentIssues(6),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Live runtime health across all services in the last 24 hours."
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Events (24h)"
            value={formatNumber(stats.events24h)}
            hint="ingested runtime events"
          />
          <StatCard
            label="Open issues"
            value={formatNumber(stats.openIssues)}
            hint="grouped by fingerprint"
            tone={stats.openIssues > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Critical alerts"
            value={formatNumber(stats.criticalAlerts)}
            hint="currently triggered"
            tone={stats.criticalAlerts > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Healthy services"
            value={`${stats.healthyServices} / ${stats.totalServices}`}
            hint={`${stats.deployments7d} deploys in last 7d`}
            tone={
              stats.healthyServices === stats.totalServices
                ? "success"
                : "warning"
            }
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            title="Runtime events over time"
            subtitle="Hourly buckets, last 24h"
            className="lg:col-span-2"
          >
            <EventsOverTimeChart data={overTime} />
          </ChartCard>
          <ChartCard
            title="Severity distribution"
            subtitle="Last 24h"
          >
            <SeverityDistributionChart data={severity} />
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            title="Runtime failures by service"
            subtitle="Last 24h"
            className="lg:col-span-2"
          >
            <EventsByServiceChart data={byService} />
          </ChartCard>
          <ChartCard
            title="Error category breakdown"
            subtitle="Last 24h"
          >
            <CategoryBreakdownChart data={byCategory} />
          </ChartCard>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            title="Deployment frequency"
            subtitle="Last 7 days, by environment"
            className="lg:col-span-2"
          >
            <DeploymentFrequencyChart data={deploymentFreq} />
          </ChartCard>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                Service health
              </h3>
              <Link
                href="/services"
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                View all
              </Link>
            </div>
            <ul className="space-y-2">
              {stats.services.slice(0, 6).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-sm"
                >
                  <Link
                    href={`/services/${s.id}`}
                    className="min-w-0 truncate font-mono text-xs text-zinc-300 hover:text-emerald-300"
                  >
                    {s.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <EnvironmentBadge environment={s.environment} />
                    <ServiceStatusBadge status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Recent issues
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Most recently seen, grouped by fingerprint
              </p>
            </div>
            <Link
              href="/issues"
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              View all issues →
            </Link>
          </div>
          {recentIssues.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No issues yet"
                description="Issues will appear here once events are ingested. Run `npm run simulate` or POST to /api/events."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {recentIssues.map((issue) => {
                const serviceName = issue.events[0]?.service.name;
                return (
                  <li key={issue.id}>
                    <Link
                      href={`/issues/${issue.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-zinc-900/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">
                          {issue.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          {serviceName ? (
                            <span className="font-mono">{serviceName}</span>
                          ) : null}
                          <span>·</span>
                          <span>{issue.occurrenceCount} occurrences</span>
                          <span>·</span>
                          <span>last seen {formatRelative(issue.lastSeenAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <IssueStatusBadge status={issue.status} />
                        <SeverityBadge severity={issue.severity} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
