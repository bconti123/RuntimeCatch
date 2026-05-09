import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewServiceForm } from "./NewServiceForm";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="New service"
        subtitle="Register a service so it can ingest runtime events."
        breadcrumbs={[
          { label: "Services", href: "/services" },
          { label: "New" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="max-w-xl rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          {projects.length === 0 ? (
            <EmptyState
              title="No projects available"
              description="Run `npm run db:seed` to create the demo project before adding services."
            />
          ) : (
            <NewServiceForm projects={projects} />
          )}
        </section>
      </div>
    </>
  );
}
