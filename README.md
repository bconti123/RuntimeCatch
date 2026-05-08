# RuntimeCatch

A self-hostable observability platform for tracking runtime errors, service failures, and application health across distributed systems.

Collect runtime events, group them into issues by fingerprint, monitor service health, and investigate failures from a centralized dashboard.

## Tech stack

- **Next.js 16** (App Router, Server Components) + **React 19**
- **TypeScript**
- **Tailwind CSS v4** (dark engineering theme)
- **Prisma 7** + **PostgreSQL 16** via Docker Compose
- **Recharts** for time-series and distribution charts
- **Zod** for runtime ingestion validation

## Screenshots

> Drop screenshots into `docs/screenshots/` and reference them here.

| Page | Path | Notes |
| --- | --- | --- |
| Dashboard | `docs/screenshots/dashboard.png` | Stat cards + 5 charts + recent issues |
| Services | `docs/screenshots/services.png` | List with health, last deploy, event volume |
| Service detail | `docs/screenshots/service-detail.png` | Timeline, deploys, alerts |
| Issues | `docs/screenshots/issues.png` | Grouped issues with severity / status filters |
| Issue detail | `docs/screenshots/issue-detail.png` | Stack trace, metadata, deploy correlation |

## Architecture

```
┌──────────────────┐    POST /api/events     ┌────────────────────┐
│ Apps & services  │ ─────────────────────▶  │  Next.js Route     │
│ (or simulator)   │                          │  app/api/events    │
└──────────────────┘                          │  • Zod validation  │
                                              │  • fingerprint     │
                                              │  • upsert Issue    │
                                              │  • insert Event    │
                                              └─────────┬──────────┘
                                                        │ Prisma 7
                                                        ▼
                                              ┌────────────────────┐
                                              │ PostgreSQL 16      │
                                              │ (Docker, :5433)    │
                                              └─────────┬──────────┘
                                                        │
                                  Server Components     │
                                  (force-dynamic)       │
                                                        ▼
                                              ┌────────────────────┐
                                              │ Dashboard / lists  │
                                              │ /  /services       │
                                              │ /issues  + detail  │
                                              └────────────────────┘
```

**Ingestion flow** (`POST /api/events`):

1. Parse + validate JSON with Zod (`service`, `severity`, `category`, `message`, optional `stackTrace`, `metadata`, `fingerprint`).
2. Look up the `Service` by name; reject with 404 if it doesn't exist.
3. Compute a deterministic `fingerprint` from `service + category + first stack frame` (or normalized message), unless one is provided.
4. In a single transaction:
   - `upsert` the `Issue` keyed on `fingerprint` — bumps `occurrenceCount`, `lastSeenAt`, and reopens it if previously resolved.
   - Insert the `RuntimeEvent` linked to that issue.
5. Return `{ eventId, issueId, fingerprint, occurrenceCount }` with HTTP 201.

The dashboard reads via Server Components with `export const dynamic = "force-dynamic"`, so every page render queries Postgres directly — no stale caches in dev.

## Project layout

```
app/
  page.tsx                       Dashboard overview
  loading.tsx                    Skeleton
  services/
    page.tsx                     Services list
    [id]/page.tsx                Service detail
  issues/
    page.tsx                     Issues list (filters)
    filter-bar.tsx               Client-side filter chips
    [id]/page.tsx                Issue detail
    [id]/IssueActions.tsx        Resolve/mute/reopen buttons
    [id]/actions.ts              Server actions
  api/events/route.ts            Ingestion endpoint
components/                      Sidebar, PageHeader, Badges, charts, etc.
lib/
  prisma.ts                      Prisma client singleton (driver-adapter)
  queries.ts                     Server-side dashboard queries
  fingerprint.ts                 Fingerprint + title helpers
  format.ts                      Time/number formatters
prisma/
  schema.prisma                  Models, enums, indexes
  seed.ts                        Realistic seed data
  migrations/                    SQL migrations
scripts/
  simulate-events.ts             Realistic event stream generator
```

## Setup

Requires Node.js 20+, npm, and Docker.

```bash
git clone https://github.com/bconti123/RuntimeCatch.git
cd RuntimeCatch
npm install
cp .env.example .env
npm run db:up        # start local Postgres
npm run db:migrate   # apply schema
npm run db:seed      # load realistic sample data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a live-looking dashboard, run the simulator alongside dev:

```bash
npm run simulate     # streams realistic events every 2-5s
```

## Database

Local development uses Postgres 16 via Docker Compose on host port **5433** (so you can keep a default system Postgres on 5432 if you have one).

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
DATABASE_URL="postgresql://runtimecatch:runtimecatch@localhost:5433/runtimecatch?schema=public"
```

The Prisma client is generated to `prisma/generated/client/` (gitignored) and instantiated via the singleton in `lib/prisma.ts`, which wires the `@prisma/adapter-pg` driver adapter required by Prisma 7.

### Schema

Core models — see `prisma/schema.prisma` for full definitions:

- **User** — `email`, `name`, `role` (USER / ADMIN / OWNER)
- **Service** — `name`, `environment` (PRODUCTION / STAGING / DEVELOPMENT), `status` (HEALTHY / DEGRADED / DOWN)
- **RuntimeEvent** — runtime errors and signals: `severity`, `category`, `message`, `stackTrace`, `metadata` (JSON), `fingerprint`, `resolved`
- **Issue** — grouped events keyed by `fingerprint`: `severity`, `status` (OPEN / RESOLVED / MUTED / IGNORED), `occurrenceCount`, `firstSeenAt`, `lastSeenAt`
- **Alert** — `severity`, `status` (TRIGGERED / ACKNOWLEDGED / RESOLVED), `triggeredAt`, `resolvedAt`
- **Deployment** — `version`, `commitSha`, `environment`, `deployedAt`

### Seed data

`prisma/seed.ts` populates a realistic snapshot:

- 6 services (`video-streaming-api`, `playback-service`, `auth-service`, `payments-api`, `recommendations-engine`, `web-frontend`)
- 7 deployments across production and staging
- 8 grouped issues with 30 underlying runtime events covering: playback errors, API latency P99 SLO breaches, deploy regressions, DB connection-pool exhaustion, JWT signature mismatches, upstream 502s, and chunk-load errors
- 5 alerts in mixed states (triggered / acknowledged / resolved)

## API: `POST /api/events`

Ingest a runtime event. The endpoint validates with Zod, computes a fingerprint, and upserts the corresponding issue.

### Request

```bash
curl -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' \
  -d '{
    "service": "playback-service",
    "severity": "CRITICAL",
    "category": "PLAYBACK_ERROR",
    "message": "DRM license timeout",
    "stackTrace": "Error: license timeout\n    at DrmClient.fetchLicense (drm.ts:54:11)",
    "metadata": {"region": "us-west", "device": "smart-tv"}
  }'
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `service` | string | yes | Must match an existing `Service.name` |
| `severity` | enum | yes | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR` \| `CRITICAL` |
| `category` | enum | yes | `RUNTIME_ERROR` \| `API_LATENCY` \| `PLAYBACK_ERROR` \| `DEPLOYMENT` \| `DATABASE` \| `NETWORK` \| `AUTH` |
| `message` | string | yes | ≤ 2,000 chars |
| `stackTrace` | string | no | ≤ 20,000 chars |
| `metadata` | object | no | Arbitrary JSON |
| `fingerprint` | string | no | Override the auto-computed fingerprint |
| `occurredAt` | ISO 8601 | no | Defaults to `now()` |

### Responses

- `201 Created` — `{ eventId, issueId, fingerprint, service, occurrenceCount }`
- `400 Bad Request` — `{ error, issues }` (Zod failure)
- `404 Not Found` — `{ error }` (service doesn't exist)

### Event simulator

`scripts/simulate-events.ts` writes realistic events directly via Prisma:

```bash
npm run simulate                                    # 2-5s jittered, runs forever
SIMULATE_INTERVAL_MS=400 npm run simulate           # tight loop
SIMULATE_DURATION_MS=30000 npm run simulate         # auto-stop after 30s
```

It cycles through weighted scenarios — DRM timeouts, P99 latency spikes, connection-pool exhaustion, chunk-load errors, deploy regressions — and respects fingerprinting so the same scenario rolls up into the same issue.

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
- Services list and detail pages
- Issues list with severity / status filters
- Issue detail with stack trace, metadata, deploy correlation, resolve / mute / reopen
- `POST /api/events` ingestion with Zod validation and fingerprint grouping
- Event simulator script

### Next
- Authentication
- Saved views and search
- Slack / webhook notifications

### Planned
- Multi-tenant projects
- Source-map symbolication
- Production Docker image

## License

MIT — see [LICENSE](./LICENSE).
