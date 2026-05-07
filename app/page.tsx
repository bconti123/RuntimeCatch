import { StatCard } from "@/components/StatCard";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-emerald-500" aria-hidden />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">RuntimeCatch</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Runtime error tracking dashboard
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            scaffold
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <section className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Live counts will populate once the database and ingestion API are wired up.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Events (24h)" value="—" hint="awaiting ingestion" />
          <StatCard label="Open issues" value="—" hint="awaiting database" />
          <StatCard label="Affected services" value="—" hint="awaiting database" />
          <StatCard label="Resolved (7d)" value="—" hint="awaiting database" />
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Error volume</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Recharts time-series goes here.
            </p>
            <div className="mt-6 flex h-48 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
              chart placeholder
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Recent issues</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Latest grouped errors.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-zinc-500 dark:text-zinc-400">
              <li className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs dark:border-zinc-700">
                no data yet
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        RuntimeCatch · MIT
      </footer>
    </div>
  );
}
