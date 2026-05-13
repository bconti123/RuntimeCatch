/**
 * @runtimecatch/client
 *
 * A tiny, dependency-free TypeScript client for reporting runtime errors and
 * application events to a RuntimeCatch instance. Designed to drop into Node.js
 * services and Next.js apps (API routes / server actions).
 *
 * Not published to npm yet — consume it from the local workspace.
 */

export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type EventCategory =
  | "RUNTIME_ERROR"
  | "API_LATENCY"
  | "PLAYBACK_ERROR"
  | "DEPLOYMENT"
  | "DATABASE"
  | "NETWORK"
  | "AUTH"
  | "APP_EVENT";

export type Metadata = Record<string, unknown>;

export interface RuntimeCatchConfig {
  /** Base URL of the RuntimeCatch instance, e.g. "https://errors.example.com". */
  apiUrl: string;
  /** Project API key (rc_live_…). */
  apiKey: string;
  /** Name of the service reporting events; must already exist in the project. */
  service: string;
  /** Logical environment label, attached to every event's metadata. */
  environment: string;
  /** Max send attempts (including the first). Default: 3. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff between retries. Default: 300. */
  retryBaseDelayMs?: number;
  /** Request timeout in ms. Default: 10_000. */
  timeoutMs?: number;
  /**
   * If true, swallow delivery errors and resolve to `null` instead of throwing.
   * Recommended for request-handler paths so reporting never breaks the app.
   * Default: true.
   */
  swallowErrors?: boolean;
  /** Optional custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch;
  /** Optional logger for swallowed errors. Defaults to `console.warn`. */
  onError?: (error: unknown) => void;
}

/** Shape POSTed to `/api/events`. */
interface EventPayload {
  service: string;
  severity: Severity;
  category: EventCategory;
  message: string;
  stackTrace?: string;
  metadata?: Metadata;
}

export interface SendResult {
  eventId: string;
  issueId: string;
  fingerprint: string;
  service: string;
  occurrenceCount: number;
}

export interface RuntimeCatchClient {
  /** Report an Error (or error-like value) as a RUNTIME_ERROR / ERROR event. */
  captureException(
    error: unknown,
    metadata?: Metadata
  ): Promise<SendResult | null>;
  /** Report a named application event as an APP_EVENT / INFO event. */
  captureEvent(name: string, metadata?: Metadata): Promise<SendResult | null>;
  /** Low-level escape hatch: send a fully-formed event payload. */
  send(
    payload: Omit<EventPayload, "service"> & { service?: string }
  ): Promise<SendResult | null>;
  readonly config: Readonly<Required<Omit<RuntimeCatchConfig, "fetch" | "onError">>>;
}

const DEFAULTS = {
  maxRetries: 3,
  retryBaseDelayMs: 300,
  timeoutMs: 10_000,
  swallowErrors: true,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown): { message: string; stackTrace?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stackTrace: error.stack };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`RuntimeCatch responded ${status}: ${body.slice(0, 500)}`);
    this.name = "RuntimeCatchHttpError";
  }
}

/** 4xx (except 429) are not worth retrying — the payload/key is wrong. */
function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 429 || error.status >= 500;
  }
  // Network failures, aborts, timeouts.
  return true;
}

export function createRuntimeCatchClient(
  config: RuntimeCatchConfig
): RuntimeCatchClient {
  if (!config.apiUrl) throw new Error("RuntimeCatch: `apiUrl` is required");
  if (!config.apiKey) throw new Error("RuntimeCatch: `apiKey` is required");
  if (!config.service) throw new Error("RuntimeCatch: `service` is required");
  if (!config.environment)
    throw new Error("RuntimeCatch: `environment` is required");

  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "RuntimeCatch: no global `fetch` available — pass `fetch` in the config (Node 18+ has it built in)"
    );
  }

  const resolved = {
    apiUrl: config.apiUrl.replace(/\/+$/, ""),
    apiKey: config.apiKey,
    service: config.service,
    environment: config.environment,
    maxRetries: Math.max(1, config.maxRetries ?? DEFAULTS.maxRetries),
    retryBaseDelayMs: config.retryBaseDelayMs ?? DEFAULTS.retryBaseDelayMs,
    timeoutMs: config.timeoutMs ?? DEFAULTS.timeoutMs,
    swallowErrors: config.swallowErrors ?? DEFAULTS.swallowErrors,
  };
  const onError =
    config.onError ??
    ((err: unknown) =>
      console.warn("[runtimecatch] failed to deliver event:", err));

  const endpoint = `${resolved.apiUrl}/api/events`;

  async function postOnce(body: string): Promise<SendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), resolved.timeoutMs);
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolved.apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new HttpError(res.status, text);
      return text ? (JSON.parse(text) as SendResult) : ({} as SendResult);
    } finally {
      clearTimeout(timer);
    }
  }

  async function deliver(payload: EventPayload): Promise<SendResult | null> {
    const body = JSON.stringify(payload);
    let lastError: unknown;
    for (let attempt = 1; attempt <= resolved.maxRetries; attempt++) {
      try {
        return await postOnce(body);
      } catch (err) {
        lastError = err;
        if (attempt === resolved.maxRetries || !isRetryable(err)) break;
        // Exponential backoff with a little jitter.
        const delay =
          resolved.retryBaseDelayMs * 2 ** (attempt - 1) +
          Math.floor(Math.random() * 100);
        await sleep(delay);
      }
    }
    if (resolved.swallowErrors) {
      onError(lastError);
      return null;
    }
    throw lastError;
  }

  function withEnv(metadata?: Metadata): Metadata {
    return {
      ...(metadata ?? {}),
      environment: resolved.environment,
      sdk: "@runtimecatch/client",
    };
  }

  const client: RuntimeCatchClient = {
    config: Object.freeze(resolved),

    send(payload) {
      return deliver({
        service: payload.service ?? resolved.service,
        severity: payload.severity,
        category: payload.category,
        message: payload.message,
        ...(payload.stackTrace ? { stackTrace: payload.stackTrace } : {}),
        metadata: withEnv(payload.metadata),
      });
    },

    captureException(error, metadata) {
      const { message, stackTrace } = normalizeError(error);
      return deliver({
        service: resolved.service,
        severity: "ERROR",
        category: "RUNTIME_ERROR",
        message,
        ...(stackTrace ? { stackTrace } : {}),
        metadata: withEnv(metadata),
      });
    },

    captureEvent(name, metadata) {
      return deliver({
        service: resolved.service,
        severity: "INFO",
        category: "APP_EVENT",
        message: name,
        metadata: withEnv(metadata),
      });
    },
  };

  return client;
}

/* ------------------------------------------------------------------ *
 * Module-level convenience API.
 *
 * Configure once at process start (the most recent `createRuntimeCatchClient`
 * call becomes the default), then call `captureException` / `captureEvent`
 * from anywhere without threading the client around.
 * ------------------------------------------------------------------ */

let defaultClient: RuntimeCatchClient | undefined;

/** Explicitly create AND register the default client in one call. */
export function configureRuntimeCatch(
  config: RuntimeCatchConfig
): RuntimeCatchClient {
  defaultClient = createRuntimeCatchClient(config);
  return defaultClient;
}

/** Replace (or clear) the default client. */
export function setDefaultRuntimeCatchClient(
  client: RuntimeCatchClient | undefined
): void {
  defaultClient = client;
}

function requireDefault(): RuntimeCatchClient {
  if (!defaultClient) {
    throw new Error(
      "RuntimeCatch: no default client configured. Call `configureRuntimeCatch({ apiUrl, apiKey, service, environment })` first, or use a client returned by `createRuntimeCatchClient()`."
    );
  }
  return defaultClient;
}

export function captureException(
  error: unknown,
  metadata?: Metadata
): Promise<SendResult | null> {
  return requireDefault().captureException(error, metadata);
}

export function captureEvent(
  name: string,
  metadata?: Metadata
): Promise<SendResult | null> {
  return requireDefault().captureEvent(name, metadata);
}
