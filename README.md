# RuntimeCatch

A self-hostable observability platform for tracking runtime errors, service failures, and application health across distributed systems.

Collect runtime events, group them into issues by fingerprint, monitor service health, and investigate failures from a centralized dashboard — behind credentials-based auth and project-scoped API keys.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19**
- **TypeScript**
- **Tailwind CSS v4** (dark engineering theme)
- **Prisma 7** + **PostgreSQL 16** via Docker Compose
- **Recharts** for time-series and distribution charts
- **Zod** for runtime ingestion validation
- **node:crypto** scrypt for password hashing, SHA-256 for API key hashing — no extra auth dependencies

## Architecture

```
┌──────────────────┐    POST /api/events     ┌────────────────────┐
│ Apps & services  │ ─────────────────────▶  │  Next.js Route     │
│ (or simulator)   │  Bearer rc_live_…       │  app/api/events    │
└──────────────────┘                          │  • API key check   │
                                              │  • Zod validation  │
                                              │  • fingerprint     │
                                              │  • upsert Issue    │
                                              │  • insert Event    │
                                              └─────────┬──────────┘
                                                        │ Prisma 7
                                                        ▼
                                              ┌────────────────────┐
                                              │ PostgreSQL 16      │
                                              │ (Docker, :5435)    │
                                              └─────────┬──────────┘
                                                        │
                                  Server Components     │
                                  (auth-gated layout)   │
                                                        ▼
                                              ┌────────────────────┐
                                              │ /  /services       │
                                              │ /issues  /settings │
                                              │ /settings/api-keys │
                                              └────────────────────┘
```

**Auth model.** A simple credentials flow: `email + password` → scrypt hash check → row in the `Session` table → opaque token in an `httpOnly` cookie. The `(authed)` route group's layout calls `requireUser()` on every render; unauthenticated users hit `redirect("/login")`. The `/login` page sits outside that group so it stays public. `/api/events` is a different surface — it ignores cookies entirely and authenticates via `Authorization: Bearer rc_live_…`.

**Ingestion flow** (`POST /api/events`):

1. Read `Authorization: Bearer rc_live_…` and look up the API key by SHA-256 hash. Reject missing, malformed, or revoked keys with `401`.
2. Parse + validate JSON with Zod (`service`, `severity`, `category`, `message`, optional `stackTrace`, `metadata`, `fingerprint`).
3. Look up the `Service` by `(projectId, name)` scoped to the API key's project; reject with `404` if it doesn't exist.
4. Compute a deterministic `fingerprint` from `service + category + first stack frame` (or normalized message), unless one is provided.
5. In a single transaction:
   - `upsert` the `Issue` keyed on `fingerprint` — bumps `occurrenceCount`, `lastSeenAt`, and reopens it if previously resolved.
   - Insert the `RuntimeEvent` linked to that issue.
6. Fire-and-forget update `ApiKey.lastUsedAt`.
7. Return `{ eventId, issueId, fingerprint, occurrenceCount }` with HTTP `201`.

## Project layout

```
app/
  layout.tsx                       Root <html>/<body>
  login/
    page.tsx, LoginForm.tsx        Public login page
    actions.ts                     Server action: verify password, create session
  (authed)/                        Route group — requireUser() in layout
    layout.tsx                     Sidebar + auth gate
    page.tsx                       Dashboard
    services/
      page.tsx, [id]/page.tsx
      new/                         Service creation flow
        page.tsx, NewServiceForm.tsx, actions.ts
    issues/
      page.tsx, filter-bar.tsx, [id]/...
    settings/
      page.tsx                     Account + project list
      api-keys/
        page.tsx, CreateKeyForm.tsx
        actions.ts                 Server actions: create / revoke
  api/
    events/route.ts                Ingestion (Bearer-protected)
    auth/logout/route.ts           POST → destroy session, redirect to /login
components/                        Sidebar, PageHeader, Badges, charts, etc.
lib/
  prisma.ts                        Prisma client singleton (driver-adapter)
  auth.ts                          scrypt hashing, session cookie, requireUser()
  api-keys.ts                      key generation + hash + Bearer parser
  queries.ts                       Server-side dashboard queries
  fingerprint.ts                   Fingerprint + title helpers
  format.ts                        Time/number formatters
prisma/
  schema.prisma                    Models, enums, indexes
  seed.ts                          Realistic seed data
  migrations/                      SQL migrations
scripts/
  simulate-events.ts               Realistic event stream generator
```

## Setup

Requires Node.js 20+, npm, and Docker.

```bash
git clone https://github.com/bconti123/RuntimeCatch.git
cd RuntimeCatch
npm install
cp .env.example .env
npm run db:up        # start local Postgres on port 5435
npm run db:migrate   # apply schema
npm run db:seed      # load realistic sample data + demo user + demo API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

### Demo credentials

The seed creates three users; all share the same password.

| Email | Role | Password |
| --- | --- | --- |
| `owner@runtimecatch.dev` | OWNER | `runtimecatch` |
| `jordan@runtimecatch.dev` | ADMIN | `runtimecatch` |
| `sam@runtimecatch.dev` | USER | `runtimecatch` |

Only `owner@runtimecatch.dev` owns the seeded `RuntimeCatch Demo` project, so it's the one you'll want to use to manage services and API keys.

### Demo API key

For local development convenience, the seed inserts an API key with a known plaintext value:

```
rc_live_demo_key_for_local_testing_only
```

In a real install, plaintext keys are generated server-side and shown to the user **exactly once** at creation time — only the SHA-256 hash and a `prefix` are persisted.

## Database

Local development uses Postgres 16 via Docker Compose on host port **5435** (so the default system Postgres on 5432–5434 won't clash).

| Command | Purpose |
| --- | --- |
| `npm run db:up` | Start the Postgres container in the background |
| `npm run db:down` | Stop the Postgres container |
| `npm run db:migrate` | Create / apply Prisma migrations (`prisma migrate dev`) |
| `npm run db:reset` | Drop the schema, re-run migrations, re-run seed |
| `npm run db:seed` | Run the seed script (`prisma/seed.ts`) |
| `npm run db:studio` | Open Prisma Studio at [localhost:5555](http://localhost:5555) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run simulate` | Stream realistic events into the DB |

Connection string lives in `.env`:

```
DATABASE_URL="postgresql://runtimecatch:runtimecatch@localhost:5435/runtimecatch?schema=public"
```

The Prisma client is generated to `prisma/generated/client/` (gitignored) and instantiated via the singleton in `lib/prisma.ts`, which wires the `@prisma/adapter-pg` driver adapter required by Prisma 7.

### Schema

Core models — see `prisma/schema.prisma` for full definitions:

- **User** — `email`, `name`, `passwordHash` (scrypt), `role` (USER / ADMIN / OWNER)
- **Session** — `token`, `userId`, `expiresAt` — opaque token referenced from the `runtimecatch_session` cookie
- **Project** — `slug`, `name`, `ownerId` — groups services and API keys under a user
- **ApiKey** — `projectId`, `name`, `keyHash` (SHA-256), `prefix`, `lastUsedAt`, `revokedAt`
- **Service** — `projectId`, `name`, `environment`, `status` — unique within a project
- **RuntimeEvent** — `severity`, `category`, `message`, `stackTrace`, `metadata`, `fingerprint`, `resolved`
- **Issue** — `fingerprint`, `severity`, `status`, `occurrenceCount`, `firstSeenAt`, `lastSeenAt`
- **Alert** — `severity`, `status` (TRIGGERED / ACKNOWLEDGED / RESOLVED), `triggeredAt`, `resolvedAt`
- **Deployment** — `version`, `commitSha`, `environment`, `deployedAt`

### Seed data

`prisma/seed.ts` populates a realistic snapshot:

- 3 users (owner / admin / user) with hashed passwords
- 1 project (`RuntimeCatch Demo`) owned by the OWNER user
- 1 demo API key with a stable plaintext for local testing
- 6 services (`video-streaming-api`, `playback-service`, `auth-service`, `payments-api`, `recommendations-engine`, `web-frontend`)
- 7 deployments across production and staging
- 8 grouped issues with 30 underlying runtime events covering: playback errors, API latency P99 SLO breaches, deploy regressions, DB connection-pool exhaustion, JWT signature mismatches, upstream 502s, chunk-load errors
- 5 alerts in mixed states (triggered / acknowledged / resolved)

## API: `POST /api/events`

Ingest a runtime event. The endpoint authenticates the API key, validates the payload with Zod, computes a fingerprint, and upserts the corresponding issue.

### Authentication

Every request must include:

```
Authorization: Bearer rc_live_<random>
```

The server SHA-256–hashes the bearer token and looks it up in the `ApiKey` table. Missing, malformed, or revoked keys → `401`. The matched key's `projectId` scopes the service lookup; `service: "<name>"` must resolve to a service in **that project** or the request returns `404`.

### Example

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer rc_live_example_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "playback-engine",
    "severity": "CRITICAL",
    "category": "PLAYBACK_ERROR",
    "message": "DRM license timeout",
    "metadata": {
      "region": "us-west",
      "device": "smart-tv"
    }
  }'
```

Use the seeded demo key for local testing:

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer rc_live_demo_key_for_local_testing_only" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "playback-service",
    "severity": "CRITICAL",
    "category": "PLAYBACK_ERROR",
    "message": "DRM license timeout",
    "metadata": {"region": "us-west", "device": "smart-tv"}
  }'
```

### Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `service` | string | yes | Must match a `Service.name` in the API key's project |
| `severity` | enum | yes | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR` \| `CRITICAL` |
| `category` | enum | yes | `RUNTIME_ERROR` \| `API_LATENCY` \| `PLAYBACK_ERROR` \| `DEPLOYMENT` \| `DATABASE` \| `NETWORK` \| `AUTH` |
| `message` | string | yes | ≤ 2,000 chars |
| `stackTrace` | string | no | ≤ 20,000 chars |
| `metadata` | object | no | Arbitrary JSON |
| `fingerprint` | string | no | Override the auto-computed fingerprint |
| `occurredAt` | ISO 8601 | no | Defaults to `now()` |

### Responses

- `201 Created` — `{ eventId, issueId, fingerprint, service, occurrenceCount }`
- `400 Bad Request` — `{ error, issues }` (Zod failure or invalid JSON)
- `401 Unauthorized` — `{ error }` (missing / invalid / revoked API key)
- `404 Not Found` — `{ error }` (service doesn't exist in this project)

### Event simulator

`scripts/simulate-events.ts` writes realistic events directly via Prisma:

```bash
npm run simulate                                    # 2-5s jittered, runs forever
SIMULATE_INTERVAL_MS=400 npm run simulate           # tight loop
SIMULATE_DURATION_MS=30000 npm run simulate         # auto-stop after 30s
```

It bypasses the HTTP API entirely (no API key required) and cycles through weighted scenarios — DRM timeouts, P99 latency spikes, connection-pool exhaustion, chunk-load errors, deploy regressions — respecting fingerprinting so the same scenario rolls up into the same issue.

## Security notes

- **Passwords** are hashed with `node:crypto` scrypt + a random 16-byte salt; comparisons use `timingSafeEqual`. Failed logins always run through `verifyPassword` even when the user doesn't exist, to avoid trivial timing oracles on user existence.
- **Sessions** are opaque random tokens (`32` bytes from `crypto.randomBytes`) stored in the `Session` table and a 30-day `httpOnly`, `SameSite=Lax` cookie. Logout deletes the row and clears the cookie.
- **API keys** are never stored in plaintext. The server generates a `rc_live_<48 hex chars>` token and persists only `keyHash = sha256(plaintext)` and a short `prefix` for UI display. Keys can be revoked at any time from `/settings/api-keys` — `revokedAt` is set, the row is preserved for audit, and lookups exclude revoked keys.
- **Project scoping.** API keys belong to a single project, and `/api/events` only accepts events for services in that project. There is no global service namespace.
- **Production hardening still TODO.** Add CSRF tokens for the logout form, rotate session tokens on privilege escalation, add per-IP rate limiting on `/login` and `/api/events`, and consider switching to Argon2id if you want to stop relying on `node:crypto` directly.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:*` | See [Database](#database) above |
| `npm run simulate` | See [Event simulator](#event-simulator) above |

## Roadmap

### Completed
- Prisma schema + Postgres via Docker Compose, with realistic seed data
- Dashboard overview (stat cards, time-series, severity / category / service / deploy charts)
- Services list, detail, and creation flow (`/services/new`)
- Issues list with severity / status filters
- Issue detail with stack trace, metadata, deploy correlation, resolve / mute / reopen
- `POST /api/events` ingestion with Zod validation and fingerprint grouping
- Event simulator script
- Credentials auth (scrypt + opaque session cookie), `(authed)` route group, login/logout
- Project model + project-scoped API keys (`rc_live_…`, SHA-256 hashed) with create / revoke UI

### Next
- Saved views and search
- Slack / webhook notifications
- Per-IP rate limiting + CSRF on auth endpoints

### Planned
- Multi-tenant teams + org-level roles
- Source-map symbolication
- Production Docker image

## License

MIT — see [LICENSE](./LICENSE).
