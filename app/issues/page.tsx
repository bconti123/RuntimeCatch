import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import {
  IssueStatusBadge,
  SeverityBadge,
} from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatNumber, formatRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type {
  IssueStatus,
  Severity,
} from "@/prisma/generated/client/client";
import { FilterBar } from "./filter-bar";

export const dynamic = "force-dynamic";

const VALID_SEVERITIES: Severity[] = [
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
];
const VALID_STATUSES: IssueStatus[] = [
  "OPEN",
  "RESOLVED",
  "MUTED",
  "IGNORED",
];

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string }>;
}) {
  const params = await searchParams;
  const severity = (VALID_SEVERITIES as string[]).includes(params.severity ?? "")
    ? (params.severity as Severity)
    : null;
  const status = (VALID_STATUSES as string[]).includes(params.status ?? "")
    ? (params.status as IssueStatus)
    : null;

  const issues = await prisma.issue.findMany({
    where: {
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    include: {
      events: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { service: { select: { name: true } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Issues"
        subtitle="Runtime events grouped by fingerprint. Filter by severity or status."
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <FilterBar severity={severity} status={status} />

        {issues.length === 0 ? (
          <EmptyState
            title="No issues match these filters"
            description={
              severity || status
                ? "Try clearing one of the filters above."
                : "Issues will show up here once events are ingested."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Issue</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Events</th>
                  <th className="px-4 py-3 font-medium">First seen</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {issues.map((issue) => {
                  const serviceName = issue.events[0]?.service.name;
                  return (
                    <tr
                      key={issue.id}
                      className="transition-colors hover:bg-zinc-900/60"
                    >
                      <td className="max-w-md px-4 py-3">
                        <Link
                          href={`/issues/${issue.id}`}
                          className="block hover:text-emerald-300"
                        >
                          <div className="truncate text-zinc-200">
                            {issue.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                            {serviceName ? (
                              <span className="font-mono">{serviceName}</span>
                            ) : null}
                            <span>·</span>
                            <span className="font-mono">
                              {issue.fingerprint.slice(0, 12)}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={issue.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <IssueStatusBadge status={issue.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                        {formatNumber(issue.occurrenceCount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatRelative(issue.firstSeenAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatRelative(issue.lastSeenAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
