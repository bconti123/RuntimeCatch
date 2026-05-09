import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateKeyForm } from "./CreateKeyForm";
import { revokeApiKeyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const apiKeys = await prisma.apiKey.findMany({
    where: { project: { ownerId: user.id } },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="Send runtime events to /api/events using Bearer authorization."
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "API keys" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">
            Create a new key
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Keys are hashed with SHA-256 before storage; the plaintext is shown
            once.
          </p>
          <div className="mt-4">
            <CreateKeyForm projects={projects} />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Existing keys
            </h2>
          </div>
          {apiKeys.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No API keys yet"
                description="Create one above to start sending events."
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Prefix</th>
                  <th className="px-5 py-3 font-medium">Last used</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-zinc-900/60">
                    <td className="px-5 py-3 text-zinc-200">{k.name}</td>
                    <td className="px-5 py-3 text-zinc-400">
                      {k.project.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-300">
                      {k.prefix}…
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {k.lastUsedAt ? formatRelative(k.lastUsedAt) : "never"}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-400">
                      {formatRelative(k.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {k.revokedAt ? (
                        <Badge tone="muted">revoked</Badge>
                      ) : (
                        <form action={revokeApiKeyAction}>
                          <input type="hidden" name="id" value={k.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                          >
                            Revoke
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
