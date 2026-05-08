import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EnvironmentBadge, ServiceStatusBadge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatNumber, formatRelative, now } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function ServicesPage() {
  const since24h = new Date(now() - DAY_MS);

  const services = await prisma.service.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const [eventsByService, deploymentsByService] = await Promise.all([
    prisma.runtimeEvent.groupBy({
      by: ["serviceId"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.deployment.findMany({
      orderBy: { deployedAt: "desc" },
      distinct: ["serviceId"],
      select: {
        serviceId: true,
        version: true,
        commitSha: true,
        deployedAt: true,
      },
    }),
  ]);

  const eventCount = new Map(
    eventsByService.map((g) => [g.serviceId, g._count._all])
  );
  const lastDeploy = new Map(deploymentsByService.map((d) => [d.serviceId, d]));

  const openIssuesByService = await prisma.runtimeEvent.groupBy({
    by: ["serviceId"],
    where: { issue: { status: "OPEN" } },
    _count: { issueId: true },
  });
  const openIssueCount = new Map(
    openIssuesByService.map((g) => [g.serviceId, g._count.issueId])
  );

  return (
    <>
      <PageHeader
        title="Services"
        subtitle={`${services.length} services across production, staging, and development`}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {services.length === 0 ? (
          <EmptyState
            title="No services registered"
            description="Run `npm run db:seed` to populate sample services."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Environment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Events 24h</th>
                  <th className="px-4 py-3 font-medium text-right">Open issues</th>
                  <th className="px-4 py-3 font-medium">Last deploy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {services.map((s) => {
                  const deploy = lastDeploy.get(s.id);
                  return (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-zinc-900/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/services/${s.id}`}
                          className="font-mono text-xs text-zinc-200 hover:text-emerald-300"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <EnvironmentBadge environment={s.environment} />
                      </td>
                      <td className="px-4 py-3">
                        <ServiceStatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                        {formatNumber(eventCount.get(s.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                        {formatNumber(openIssueCount.get(s.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {deploy ? (
                          <div>
                            <div className="font-mono text-zinc-300">
                              {deploy.version}
                            </div>
                            <div className="text-zinc-500">
                              {formatRelative(deploy.deployedAt)} ·{" "}
                              <span className="font-mono">
                                {deploy.commitSha.slice(0, 7)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600">never</span>
                        )}
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
