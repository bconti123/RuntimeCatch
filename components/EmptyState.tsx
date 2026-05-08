import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
      <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-zinc-800/60">
        <span className="block h-2 w-2 rounded-full bg-zinc-500" />
      </div>
      <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
