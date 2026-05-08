import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  trend?: ReactNode;
  tone?: "default" | "danger" | "warning" | "success";
};

const TONE_RING: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "ring-zinc-800",
  danger: "ring-red-500/40",
  warning: "ring-amber-500/40",
  success: "ring-emerald-500/40",
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  tone = "default",
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 ring-1 ${TONE_RING[tone]}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100 tabular-nums">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
        {hint ? <span>{hint}</span> : null}
        {trend}
      </div>
    </div>
  );
}
