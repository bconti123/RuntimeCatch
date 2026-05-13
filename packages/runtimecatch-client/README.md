# @runtimecatch/client

Tiny TypeScript client for reporting runtime errors and application events to a
[RuntimeCatch](../../README.md) instance.

- One helper to report an error: `captureException(error, metadata?)`
- One helper to report an event: `captureEvent(name, metadata?)`
- Built-in retry with exponential backoff
- Zero runtime dependencies (uses the global `fetch`, Node 18+)
- **Not published to npm** — consume it from the local workspace for now

## Install (local workspace)

This package lives in `packages/runtimecatch-client`. From another project in
this repo (or a sibling repo), reference it directly:

```jsonc
// package.json
{
  "dependencies": {
    "@runtimecatch/client": "file:../RuntimeCatch/packages/runtimecatch-client"
  }
}
```

Then build it once so `dist/` exists:

```bash
cd packages/runtimecatch-client
npm install
npm run build
```

(If your bundler can consume TypeScript sources directly — e.g. Next.js with
`transpilePackages` — you can skip the build and import from `src/index.ts`.)

## Configuration

```ts
import { configureRuntimeCatch } from "@runtimecatch/client";

configureRuntimeCatch({
  apiUrl: process.env.RUNTIMECATCH_URL!,        // e.g. https://errors.example.com
  apiKey: process.env.RUNTIMECATCH_API_KEY!,    // rc_live_…
  service: "checkout-api",                       // must already exist in the project
  environment: process.env.NODE_ENV ?? "development",
  // optional:
  // maxRetries: 3,
  // retryBaseDelayMs: 300,
  // timeoutMs: 10_000,
  // swallowErrors: true,   // never throw from a request handler (default)
});
```

`configureRuntimeCatch` registers a process-wide default client so you can call
`captureException` / `captureEvent` from anywhere. Prefer an explicit instance?
Use `createRuntimeCatchClient(config)` and call `.captureException()` /
`.captureEvent()` on it.

## Next.js usage

### Route handler (App Router)

```ts
// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { captureException, captureEvent } from "@runtimecatch/client";
import { placeOrder } from "@/lib/orders";

export async function POST(req: Request) {
  const { cartId } = await req.json();
  try {
    const order = await placeOrder(cartId);
    await captureEvent("order.placed", { orderId: order.id, cartId });
    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    await captureException(err, { route: "POST /api/checkout", cartId });
    return NextResponse.json({ error: "Could not place order" }, { status: 500 });
  }
}
```

### Server action

```ts
// app/account/actions.ts
"use server";

import { captureException, captureEvent } from "@runtimecatch/client";
import { updateProfile } from "@/lib/account";

export async function saveProfile(formData: FormData) {
  try {
    await updateProfile(Object.fromEntries(formData));
    await captureEvent("profile.updated", { fields: [...formData.keys()] });
  } catch (err) {
    await captureException(err, { action: "saveProfile" });
    throw err; // still surface it to the UI
  }
}
```

> Tip: run `configureRuntimeCatch(...)` once from a module that's imported early
> (e.g. `instrumentation.ts` in Next.js, or a small `lib/runtimecatch.ts` that
> the above files import).

## What gets sent

`captureException(error, metadata?)` →

```jsonc
{
  "service": "<config.service>",
  "severity": "ERROR",
  "category": "RUNTIME_ERROR",
  "message": "<error.message>",
  "stackTrace": "<error.stack>",
  "metadata": { ...metadata, "environment": "<config.environment>", "sdk": "@runtimecatch/client" }
}
```

`captureEvent(name, metadata?)` →

```jsonc
{
  "service": "<config.service>",
  "severity": "INFO",
  "category": "APP_EVENT",
  "message": "<name>",
  "metadata": { ...metadata, "environment": "<config.environment>", "sdk": "@runtimecatch/client" }
}
```

Both POST to `${apiUrl}/api/events` with `Authorization: Bearer <apiKey>`.

## Retry behavior

Each send is attempted up to `maxRetries` times (default 3). Network errors,
timeouts, HTTP 429 and 5xx are retried with exponential backoff
(`retryBaseDelayMs * 2^(n-1)` + jitter); 4xx responses (bad payload / bad key)
fail fast. With `swallowErrors: true` (the default) a permanently failing send
resolves to `null` and is logged via `onError` instead of throwing — so error
reporting never takes down the code path it's instrumenting.

## API

| Export | Description |
| --- | --- |
| `createRuntimeCatchClient(config)` | Create an explicit client instance. |
| `configureRuntimeCatch(config)` | Create a client and register it as the process default. |
| `setDefaultRuntimeCatchClient(client \| undefined)` | Swap or clear the default client (handy in tests). |
| `captureException(error, metadata?)` | Report an error via the default client. |
| `captureEvent(name, metadata?)` | Report a named event via the default client. |
| `client.send(payload)` | Low-level: send a fully-formed event payload. |

Types `RuntimeCatchConfig`, `RuntimeCatchClient`, `Severity`, `EventCategory`,
`Metadata`, and `SendResult` are exported too.
