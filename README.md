# RuntimeCatch

A self-hostable observability platform for runtime errors, service health, and deployments. Think of it as a single-binary, single-developer answer to "where did this break and why?"

Built with **Next.js 16** (App Router + Server Components + Server Actions), **Prisma 7** + **PostgreSQL 16**, **TypeScript**, **Tailwind v4**, and **Zod**. Auth is credentials-based; ingestion is project-scoped via hashed API keys. No third-party auth or telemetry SDKs — just `node:crypto`.

---

## Screenshots

> Drop captures into `public/screenshots/` using the filenames below.

| | |
| --- | --- |
| ![Dashboard](public/screenshots/dashboard.png) | ![Issue detail](public/screenshots/issue-detail.png) |
| **Dashboard** — stat cards, hourly event volume, severity / category breakdowns, recent issues | **Issue detail** — stack trace, metadata, deploy correlation, resolve / mute / reopen |
| ![Services](public/screenshots/services.png) | ![API keys](public/screenshots/api-keys.png) |
| **Services** — health, last deploy, 24h event volume per service | **API keys** — create-once flow, SHA-256 stored, project-scoped, revocable |
| ![Login](public/screenshots/login.png) | ![Service detail](public/screenshots/service-detail.png) |
| **Login** — credentials auth (scrypt + opaque session cookie) | **Service detail** — timeline, alerts, deployment history |

### Screenshots to capture

These are the six shots most worth recording. Save each one at the path shown above (PNG, ~1600px wide is plenty).

1. **`dashboard.png`** — the seeded dashboard at `/` after `npm run db:seed`. Best taken with the simulator running for ~30 seconds first (`npm run simulate`) so the timeline has movement.
2. **`issue-detail.png`** — `/issues/[id]` for the `TypeError: cannot read properties of undefined (reading 'manifest')` issue from the seed. Stack trace + metadata + deploy correlation are the technical sell here.
3. **`services.png`** — `/services` showing the table with mixed health states (DEGRADED / DOWN / HEALTHY) and last-deploy column populated.
4. **`api-keys.png`** — `/settings/api-keys` immediately after creating a key, while the green "Copy this key now — it won't be shown again" panel is visible. This screenshot tells the security story instantly.
5. **`login.png`** — `/login` with the demo-credentials hint card visible.
6. **`service-detail.png`** — `/services/[id]` for `playback-service`. Event timeline + alerts + deployments stacked.

---

## How to demo this project

Five minutes from clone to a live dashboard with streaming events:

```bash
git clone https://github.com/bconti123/RuntimeCatch.git && cd RuntimeCatch
npm install
cp .env.example .env
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev
```

Then in the browser:

1. **Open** [localhost:3000](http://localhost:3000) → redirected to `/login`.
2. **Sign in** as `owner@runtimecatch.dev` / `runtimecatch`.
3. **Watch the dashboard.** In another terminal, run `npm run simulate` to stream realistic events every 2–5s — the charts update on refresh.
4. **Investigate an issue.** Click any row in *Recent issues* to see stack trace, metadata, and which deploy it correlates with.
5. **Show the API.** From a third terminal, hit the ingestion endpoint with the seeded demo key:
   ```bash
   curl -X POST http://localhost:3000/api/events \
     -H "Authorization: Bearer rc_live_demo_key_for_local_testing_only" \
     -H "Content-Type: application/json" \
     -d '{
       "service": "playback-service",
       "severity": "CRITICAL",
       "category": "PLAYBACK_ERROR",
       "message": "DRM license timeout",
       "metadata": { "region": "us-west", "device": "smart-tv" }
     }'
   ```
   Then drop the `Bearer` header — the same request returns `401`.
6. **Manage keys.** Visit `/settings/api-keys`, create a key, copy it (shown once), revoke it. Visit `/services/new` to register a new service under the demo project.

Total runtime: one Postgres container + one Next.js dev server. No cloud, no signup, no API keys to provision.

---

## Technical highlights

**Credentials auth, no library.** Passwords are hashed with `node:crypto` `scrypt` + 16-byte random salt, compared with `timingSafeEqual`. Login always runs the verifier even when the user doesn't exist, to avoid a trivial timing oracle on user existence. Sessions are 32-byte random tokens stored in a `Session` table and an `httpOnly`, `SameSite=Lax` cookie — logout deletes the row and clears the cookie. Auth gating lives in the `app/(authed)/` route group's layout, which calls `requireUser()` on every render; the `/login` route sits outside that group so it stays public. See `lib/auth.ts`.

**Project-scoped API keys.** Each `ApiKey` belongs to a `Project`, and the plaintext is generated server-side as `rc_live_<48 hex>`. Only `keyHash = sha256(plaintext)` and a 12-character `prefix` are persisted — the plaintext is shown once at creation time. Revocation sets `revokedAt` (preserves audit trail) and excludes the row from lookups. Keys can never be re-displayed. See `lib/api-keys.ts` and `app/(authed)/settings/api-keys/`.

**Bearer-protected ingestion.** `POST /api/events` reads `Authorization: Bearer rc_live_…`, hashes the token, and looks it up by `keyHash`. The matched key's `projectId` scopes the service lookup — `service: "<name>"` must resolve via `(projectId, name)` or the request is rejected with `404`. There is no global service namespace. `lastUsedAt` is bumped fire-and-forget so it doesn't block the response. See `app/api/events/route.ts`.

**Fingerprint-based issue grouping.** Every event is fingerprinted from `service + category + first stack frame` (or normalized message if no stack). The ingestion handler runs a single `prisma.$transaction` that `upsert`s the `Issue` keyed on `fingerprint` (incrementing `occurrenceCount`, advancing `lastSeenAt`, reopening if previously resolved) and inserts the `RuntimeEvent` linked to that issue. The issues page is just `findMany` with severity / status filters; no separate aggregation pipeline. See `lib/fingerprint.ts` and `app/api/events/route.ts`.

**Prisma + PostgreSQL schema design.** Eight models (`User`, `Session`, `Project`, `ApiKey`, `Service`, `RuntimeEvent`, `Issue`, `Alert`, `Deployment`) with deliberate composite indexes — `RuntimeEvent` is indexed on `(serviceId, createdAt)`, `(category, createdAt)`, and `fingerprint`; `Issue` on `(status, lastSeenAt)`; `Alert` on `(serviceId, status)` and `(status, triggeredAt)`. `Service` has `@@unique([projectId, name])` so the same service name can exist across tenants. The Prisma client uses the `@prisma/adapter-pg` driver adapter (Prisma 7's required path for native Node).

**Docker-based local dev.** `docker compose up` brings up Postgres 16 on port `5435` (chosen to coexist with system Postgres installs on 5432–5434). Migrations and the seed run idempotently — `npm run db:reset` drops, migrates, and reseeds in a single command. The seed creates 3 users, 1 project, 1 stable demo API key, 6 services, 7 deployments, 8 grouped issues, 30 events, and 5 alerts so the dashboard is never empty.

---

## API: `POST /api/events`

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer rc_live_example_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "playback-engine",
    "severity": "CRITICAL",
    "category": "PLAYBACK_ERROR",
    "message": "DRM license timeout",
    "metadata": { "region": "us-west", "device": "smart-tv" }
  }'
```

| Field | Type | Required |
| --- | --- | --- |
| `service` | string | yes — must exist in the API key's project |
| `severity` | enum | yes — `DEBUG` \| `INFO` \| `WARNING` \| `ERROR` \| `CRITICAL` |
| `category` | enum | yes — `RUNTIME_ERROR` \| `API_LATENCY` \| `PLAYBACK_ERROR` \| `DEPLOYMENT` \| `DATABASE` \| `NETWORK` \| `AUTH` |
| `message` | string | yes — ≤ 2,000 chars |
| `stackTrace` | string | no — ≤ 20,000 chars |
| `metadata` | object | no — arbitrary JSON |
| `fingerprint` | string | no — overrides auto-computed |
| `occurredAt` | ISO 8601 | no — defaults to `now()` |

Responses: `201` with `{ eventId, issueId, fingerprint, occurrenceCount }`, `400` on Zod failure, `401` on missing/invalid/revoked key, `404` if the service isn't in the key's project.

---

## What I would build next

Roughly ordered by what I think is most worth doing next, given the current shape of the codebase:

- **Saved views + full-text search.** Issues are the right place to add `tsvector` indexes; Postgres can carry this without a separate search service.
- **Slack / webhook notifications on alert transitions** — wire `Alert.status` changes through a tiny outbox table so retries and dedupe are explicit instead of best-effort.
- **Per-IP rate limiting on `/login` and `/api/events`**, plus CSRF tokens on the logout form. Both are small, both are real production requirements.
- **Multi-tenant teams + org roles.** The schema is already factored around `Project.ownerId`; adding `Membership(userId, projectId, role)` is mostly a join.
- **Source-map symbolication** for `RuntimeEvent.stackTrace`, kicked off as a background job after ingestion. This is where the project would start needing a queue (BullMQ or Postgres `LISTEN/NOTIFY`).
- **Production Docker image + a `docker-compose.production.yml`** so the "self-hostable" claim is one `docker compose up` away from being literally true.
- **Argon2id** in place of `node:crypto` scrypt once the rest of the auth surface stabilizes — the abstraction in `lib/auth.ts` is already in the right shape for a swap.

---

## Demo credentials

| Email | Role | Password |
| --- | --- | --- |
| `owner@runtimecatch.dev` | OWNER | `runtimecatch` |
| `jordan@runtimecatch.dev` | ADMIN | `runtimecatch` |
| `sam@runtimecatch.dev` | USER | `runtimecatch` |

Demo API key (plaintext, local dev only — real keys are shown once and never reachable from the database):

```
rc_live_demo_key_for_local_testing_only
```

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:reset` | Drop, migrate, reseed in one shot |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run simulate` | Stream realistic events into the DB |

---

## License

MIT — see [LICENSE](./LICENSE).
