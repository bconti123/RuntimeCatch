import type { ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="h-64 w-full min-w-0">{children}</div>
    </div>
  );
}
