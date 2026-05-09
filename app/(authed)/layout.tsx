import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full">
      <Sidebar user={{ name: user.name, email: user.email }} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
