"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const SEVERITIES = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const;
const STATUSES = ["OPEN", "RESOLVED", "MUTED", "IGNORED"] as const;

export function FilterBar({
  severity,
  status,
}: {
  severity: string | null;
  status: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (key: "severity" | "status", value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      router.push(`/issues${qs ? `?${qs}` : ""}`);
    });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <FilterGroup
        label="Severity"
        value={severity}
        options={[...SEVERITIES]}
        onChange={(v) => setParam("severity", v)}
      />
      <FilterGroup
        label="Status"
        value={status}
        options={[...STATUSES]}
        onChange={(v) => setParam("status", v)}
      />
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/40 p-1">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={chipClass(value === null)}
        >
          all
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? null : opt)}
            className={chipClass(value === opt)}
          >
            {opt.toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function chipClass(active: boolean) {
  return [
    "rounded px-2 py-1 text-[11px] font-medium transition-colors",
    active
      ? "bg-zinc-800 text-zinc-100"
      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
  ].join(" ");
}
