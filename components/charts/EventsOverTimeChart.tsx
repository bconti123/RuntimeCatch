"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Bucket = { ts: number; total: number; critical: number };

export function EventsOverTimeChart({ data }: { data: Bucket[] }) {
  const formatted = data.map((d) => ({
    label: new Date(d.ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: false,
    }),
    total: d.total,
    critical: d.critical,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formatted} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="areaTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="areaCritical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#52525b"
          tick={{ fill: "#71717a", fontSize: 11 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Total events"
          stroke="#10b981"
          fill="url(#areaTotal)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="critical"
          name="Critical"
          stroke="#ef4444"
          fill="url(#areaCritical)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
