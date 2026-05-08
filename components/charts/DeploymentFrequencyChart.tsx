"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DeploymentFrequencyChart({
  data,
}: {
  data: Array<{ day: string; prod: number; staging: number }>;
}) {
  const formatted = data.map((d) => ({
    label: new Date(d.day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    prod: d.prod,
    staging: d.staging,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
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
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
          iconType="square"
        />
        <Bar
          dataKey="prod"
          name="production"
          stackId="a"
          fill="#ef4444"
          radius={[0, 0, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="staging"
          name="staging"
          stackId="a"
          fill="#0ea5e9"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
