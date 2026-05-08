"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS: Record<string, string> = {
  DEBUG: "#52525b",
  INFO: "#0ea5e9",
  WARNING: "#f59e0b",
  ERROR: "#f97316",
  CRITICAL: "#ef4444",
};

export function SeverityDistributionChart({
  data,
}: {
  data: Array<{ severity: string; count: number }>;
}) {
  const visible = data.filter((d) => d.count > 0);
  if (visible.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        No events in this window.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={visible}
          dataKey="count"
          nameKey="severity"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
          stroke="#09090b"
        >
          {visible.map((entry) => (
            <Cell key={entry.severity} fill={COLORS[entry.severity]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
