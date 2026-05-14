# RuntimeCatch — Next.js integration example

A minimal, copy-paste-friendly example of reporting events and exceptions from another Next.js (App Router) project to a running RuntimeCatch instance, using the local TypeScript client SDK at `packages/runtimecatch-client`.

## Files

- `.env.example` — the four env vars the client needs.
- `lib/runtimecatch.ts` — configures the default client once and re-exports the capture helpers.
- `app/admin/actions.ts` — server action that reports a successful event.
- `app/api/widgets/route.ts` — route handler that reports a caught exception.

## Wiring the SDK into your app

The SDK isn't on npm yet, so pick whichever drop-in works for you:

**Vendor the dist files.** Copy `packages/runtimecatch-client/dist/index.js` and `index.d.ts` from this repo into your app at `lib/runtimecatch-client/`, then change the imports in `lib/runtimecatch.ts` from `"@runtimecatch/client"` to `"@/lib/runtimecatch-client"`.

**Install from a local path.** If RuntimeCatch lives next to your app on disk, give the SDK package a `package.json` (`{ "name": "@runtimecatch/client", "main": "dist/index.js", "types": "dist/index.d.ts" }`) and run `npm install file:../RuntimeCatch/packages/runtimecatch-client` — then the `"@runtimecatch/client"` import resolves as-is.

## Setup

```bash
cp .env.example .env.local
```

Fill in the four `RUNTIMECATCH_*` variables. For local dev against a freshly seeded RuntimeCatch the defaults already work — `playback-service` is one of the seeded services and the demo key is the seeded plaintext key.

## Test it

With the RuntimeCatch dev server running (`npm run dev` in the RuntimeCatch repo):

1. **Server action.** Trigger `publishPost` (e.g. submit a form that calls it) — a new `post.published` row appears in the RuntimeCatch dashboard under *Recent events*, category `APP_EVENT`.
2. **Route handler exception.** `curl http://localhost:3000/api/widgets` (no `id`) — the handler returns `500` and an `ERROR` / `RUNTIME_ERROR` issue lands on the dashboard with the stack trace and the `route` + `url` metadata you attached.

Delivery is fire-and-forget: the client retries with exponential backoff and, by default, swallows failures so RuntimeCatch being down can't break your app.
