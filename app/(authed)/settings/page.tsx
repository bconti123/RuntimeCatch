import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { services: true, apiKeys: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, projects, and API access."
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Account</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Name</dt>
              <dd className="mt-1 text-zinc-200">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
              <dd className="mt-1 font-mono text-zinc-200">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Role</dt>
              <dd className="mt-1 text-zinc-200">{user.role}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Projects</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Projects group services and API keys.
              </p>
            </div>
            <Link
              href="/settings/api-keys"
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              Manage API keys →
            </Link>
          </div>
          {projects.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No projects yet"
                description="Run `npm run db:seed` to create the demo project."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-200">
                      {p.name}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      <span className="font-mono">{p.slug}</span>
                      <span className="mx-1.5">·</span>
                      created {formatRelative(p.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span>{p._count.services} services</span>
                    <span>{p._count.apiKeys} keys</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
