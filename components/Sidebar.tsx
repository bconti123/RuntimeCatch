"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", match: (p: string) => p === "/" },
  {
    href: "/services",
    label: "Services",
    match: (p: string) => p === "/services" || p.startsWith("/services/"),
  },
  {
    href: "/issues",
    label: "Issues",
    match: (p: string) => p === "/issues" || p.startsWith("/issues/"),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (p: string) => p === "/settings" || p.startsWith("/settings/"),
  },
];

export function Sidebar({
  user,
}: {
  user: { name: string; email: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 px-4 py-5 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/40">
          <span className="block h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <div>
          <div className="text-sm font-semibold tracking-tight">RuntimeCatch</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            observability
          </div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-800/80 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
          <div className="truncate font-medium text-zinc-200">{user.name}</div>
          <div className="truncate text-zinc-500">{user.email}</div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button
              type="submit"
              className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-300">Postgres connected</span>
          </div>
          <div className="mt-1">localhost:5435</div>
        </div>
      </div>
    </aside>
  );
}
