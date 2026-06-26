import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/40">
            <span className="block h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">RuntimeCatch</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              observability
            </div>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Use your RuntimeCatch credentials to access the dashboard.
        </p>

        <LoginForm />

        <div className="mt-6 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
          <div className="font-medium text-zinc-300">Demo credentials</div>
          <div className="mt-1 font-mono">Username: owner@runtimecatch.dev</div>
          <div className="font-mono">Password: runtimecatch</div>
        </div>
      </div>
    </div>
  );
}
