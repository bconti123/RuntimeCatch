import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  CategoryBadge,
  IssueStatusBadge,
  SeverityBadge,
} from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { MetadataViewer } from "@/components/MetadataViewer";
import { StackTraceBlock } from "@/components/StackTraceBlock";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { IssueActions } from "./IssueActions";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { service: { select: { id: true, name: true } } },
      },
    },
  });
  if (!issue) notFound();

  const latest = issue.events[0];
  const services = Array.from(
    new Map(issue.events.map((e) => [e.service.id, e.service])).values()
  );

  const since = new Date(issue.firstSeenAt.getTime() - HOUR_MS);
  const relatedDeployments =
    services.length > 0
      ? await prisma.deployment.findMany({
          where: {
            serviceId: { in: services.map((s) => s.id) },
            deployedAt: { gte: since, lte: issue.lastSeenAt },
          },
          orderBy: { deployedAt: "desc" },
          take: 5,
        })
      : [];

  return (
    <>
      <PageHeader
        title={issue.title}
        subtitle={`Fingerprint ${issue.fingerprint}`}
        breadcrumbs={[
          { label: "Issues", href: "/issues" },
          { label: issue.title },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <SeverityBadge severity={issue.severity} />
            <IssueStatusBadge status={issue.status} />
            <IssueActions issueId={issue.id} status={issue.status} />
          </div>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Occurrences"
            value={formatNumber(issue.occurrenceCount)}
          />
          <StatCard
            label="First seen"
            value={formatRelative(issue.firstSeenAt)}
            hint={formatDateTime(issue.firstSeenAt)}
          />
          <StatCard
            label="Last seen"
            value={formatRelative(issue.lastSeenAt)}
            hint={formatDateTime(issue.lastSeenAt)}
          />
          <StatCard
            label="Affected services"
            value={formatNumber(services.length)}
            hint={services.map((s) => s.name).join(", ")}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">
              Stack trace
            </h3>
            <StackTraceBlock trace={latest?.stackTrace ?? null} />
            <div className="mt-2 text-xs text-zinc-500">
              {latest ? `From event at ${formatDateTime(latest.createdAt)}` : null}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">
              Metadata
            </h3>
            <MetadataViewer data={latest?.metadata ?? null} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 lg:col-span-2">
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                Related runtime events
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Showing {issue.events.length} of {issue.occurrenceCount}
              </p>
            </div>
            {issue.events.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No events linked yet" />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {issue.events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 px-5 py-3 text-sm"
                  >
                    <Link
                      href={`/services/${e.service.id}`}
                      className="font-mono text-xs text-zinc-300 hover:text-emerald-300"
                    >
                      {e.service.name}
                    </Link>
                    <span className="text-zinc-600">·</span>
                    <span className="flex-1 text-xs text-zinc-500">
                      {formatRelative(e.createdAt)}
                    </span>
                    <CategoryBadge category={e.category} />
                    <SeverityBadge severity={e.severity} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                Deploy correlation
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Deploys near this issue&apos;s window
              </p>
            </div>
            {relatedDeployments.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No related deploys"
                  description="No deployments overlapped this issue’s lifetime."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {relatedDeployments.map((d) => (
                  <li key={d.id} className="px-5 py-3 text-sm">
                    <div className="font-mono text-zinc-200">{d.version}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      <span className="font-mono">
                        {d.commitSha.slice(0, 7)}
                      </span>
                      {" · "}
                      {formatDateTime(d.deployedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
