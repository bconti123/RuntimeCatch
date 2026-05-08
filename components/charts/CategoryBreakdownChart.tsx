"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS: Record<string, string> = {
  RUNTIME_ERROR: "#f97316",
  API_LATENCY: "#f59e0b",
  PLAYBACK_ERROR: "#ef4444",
  DEPLOYMENT: "#0ea5e9",
  DATABASE: "#a855f7",
  NETWORK: "#3b82f6",
  AUTH: "#71717a",
};

export function CategoryBreakdownChart({
  data,
}: {
  data: Array<{ category: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        No events in this window.
      </div>
    );
  }
  const formatted = data.map((d) => ({
    category: d.category,
    label: d.category.replace("_", " ").toLowerCase(),
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 10 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "#27272a" }}
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {formatted.map((entry) => (
            <Cell
              key={entry.category}
              fill={COLORS[entry.category] ?? "#10b981"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
