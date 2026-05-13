import type { ReactNode } from "react";
import type {
  AlertStatus,
  Environment,
  EventCategory,
  IssueStatus,
  ServiceStatus,
  Severity,
} from "@/prisma/generated/client/client";

type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "critical"
  | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700",
  info: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30",
  success: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30",
  danger: "bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/30",
  critical: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
  muted: "bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const SEVERITY_TONE: Record<Severity, Tone> = {
  DEBUG: "muted",
  INFO: "info",
  WARNING: "warning",
  ERROR: "danger",
  CRITICAL: "critical",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity}</Badge>;
}

const SERVICE_STATUS_TONE: Record<ServiceStatus, Tone> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "critical",
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge tone={SERVICE_STATUS_TONE[status]}>
      <span
        className={`block h-1.5 w-1.5 rounded-full ${
          status === "HEALTHY"
            ? "bg-emerald-400"
            : status === "DEGRADED"
              ? "bg-amber-400"
              : "bg-red-400"
        }`}
      />
      {status.toLowerCase()}
    </Badge>
  );
}

const ENV_TONE: Record<Environment, Tone> = {
  PRODUCTION: "danger",
  STAGING: "info",
  DEVELOPMENT: "muted",
};

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  const label =
    environment === "PRODUCTION"
      ? "prod"
      : environment === "STAGING"
        ? "staging"
        : "dev";
  return <Badge tone={ENV_TONE[environment]}>{label}</Badge>;
}

const ISSUE_STATUS_TONE: Record<IssueStatus, Tone> = {
  OPEN: "danger",
  RESOLVED: "success",
  MUTED: "muted",
  IGNORED: "muted",
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <Badge tone={ISSUE_STATUS_TONE[status]}>{status.toLowerCase()}</Badge>;
}

const ALERT_STATUS_TONE: Record<AlertStatus, Tone> = {
  TRIGGERED: "critical",
  ACKNOWLEDGED: "warning",
  RESOLVED: "success",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge tone={ALERT_STATUS_TONE[status]}>{status.toLowerCase()}</Badge>
  );
}

const CATEGORY_TONE: Record<EventCategory, Tone> = {
  RUNTIME_ERROR: "danger",
  API_LATENCY: "warning",
  PLAYBACK_ERROR: "critical",
  DEPLOYMENT: "info",
  DATABASE: "warning",
  NETWORK: "info",
  AUTH: "neutral",
  APP_EVENT: "neutral",
};

export function CategoryBadge({ category }: { category: EventCategory }) {
  return (
    <Badge tone={CATEGORY_TONE[category]}>
      {category.replace("_", " ").toLowerCase()}
    </Badge>
  );
}
