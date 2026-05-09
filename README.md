# RuntimeCatch

A self-hostable observability platform for runtime errors, service health, and deployments. Think of it as a self-contained, single-developer answer to "where did this break and why?"

Built with **Next.js 16** (App Router + Server Components + Server Actions), **Prisma 7** + **PostgreSQL 16**, **TypeScript**, **Tailwind v4**, and **Zod**. Auth is credentials-based; ingestion is project-scoped via hashed API keys. No third-party auth or telemetry SDKs — just `node:crypto`.

---

## Screenshots

| | |
| --- | --- |
| ![Dashboard](public/screenshots/dashboard.png) | ![Issue detail](public/screenshots/issue-detail.png) |
| **Dashboard** — stat cards, hourly event volume, severity / category breakdowns, recent issues | **Issue detail** — stack trace, metadata, deploy correlation, resolve / mute / reopen |
| ![Services](public/screenshots/services.png) | ![API keys](public/screenshots/api-keys.png) |
| **Services** — health, last deploy, 24h event volume per service | **API keys** — create-once flow, SHA-256 hashed at rest, project-scoped, revocable |
| ![Login](public/screenshots/login.png) | ![Service detail](public/screenshots/service-detail.png) |
| **Login** — credentials auth (scrypt + opaque session cookie) | **Service detail** — timeline, alerts, deployment history |

---

## Technical highlights

- Credentials-based authentication with hashed passwords and httpOnly session cookies
- Project-scoped API keys with SHA-256 stored hashes
- Bearer-protected event ingestion API
- Zod request validation and deterministic issue fingerprinting
- Prisma/PostgreSQL data model for services, issues, alerts, deployments, and runtime events
- Docker Compose local development environment

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
   Then drop the `Authorization` header — the same request returns `401`.
6. **Manage keys.** Visit `/settings/api-keys`, create a key, copy it (shown once), revoke it. Visit `/services/new` to register a new service under the demo project.

Total runtime: one Postgres container + one Next.js dev server. No cloud, no signup, no third-party services to wire up.

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
