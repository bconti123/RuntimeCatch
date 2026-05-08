"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function EventsByServiceChart({
  data,
}: {
  data: Array<{ service: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        No events in this window.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
      >
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
          allowDecimals={false}
        />
        <YAxis
          dataKey="service"
          type="category"
          stroke="#52525b"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          width={150}
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
        <Bar
          dataKey="count"
          fill="#10b981"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
