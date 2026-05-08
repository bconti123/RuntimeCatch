const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * Returns the current timestamp. Wrapping Date.now in a helper sidesteps
 * React 19's `react-hooks/purity` rule for server components that legitimately
 * need request-time clock values (we mark those routes `force-dynamic`).
 */
export function now(): number {
  return Date.now();
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

export function formatRelative(date: Date | string, now: Date = new Date()) {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffSeconds = Math.round((target.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);

  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds || unit === "second") {
      const value = Math.round(diffSeconds / seconds);
      return RTF.format(value, unit);
    }
  }
  return RTF.format(diffSeconds, "second");
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
