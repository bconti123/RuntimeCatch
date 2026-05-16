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

## Docker local development

Everything (web + Postgres) runs in Docker, isolated from any other local stacks.

```bash
cp .env.example .env          # ports + database config live here
docker compose up --build
# in another terminal, once the web container is healthy:
docker compose exec web npx prisma migrate dev
docker compose exec web npm run db:seed
```

Then visit [localhost:3000](http://localhost:3000) and sign in with the demo credentials below.

### Configuration (`.env`)

Compose reads its host-side ports from `.env`:

| Variable | Default | Effect |
| --- | --- | --- |
| `WEB_PORT` | `3000` | Host port the web app is published on → `http://localhost:${WEB_PORT}` |
| `POSTGRES_HOST_PORT` | `5435` | Host port Postgres is published on (avoids clashing with a system Postgres on 5432-5434) |

The containers always listen on their standard internal ports — web on `3000`, Postgres on `5432` — so changing the host ports never affects anything running *inside* the compose network.

### Host vs. Docker-internal `DATABASE_URL`

There are two database URLs, and which one applies depends on where the app process runs:

- **Host URL** (`DATABASE_URL` in `.env`): used when the app runs on your machine (`npm run dev`). Connects via `localhost:${POSTGRES_HOST_PORT}` — i.e. the port the container publishes on the host. Keep this port in sync with `POSTGRES_HOST_PORT`.
- **Docker-internal URL**: used when the app runs inside the compose network (`docker compose up`). Connects to the `postgres` *service name* on the container's internal port `5432` — never `localhost`, never `POSTGRES_HOST_PORT`. This URL is set on the `web` service in `docker-compose.yml` and overrides whatever `DATABASE_URL` is in `.env`, so you don't change anything to switch between the two modes.

### What the compose stack provides

- `runtimecatch-web` — Next.js dev server, bind-mounted for live reload, published on host `:${WEB_PORT}`.
- `runtimecatch-postgres` — Postgres 16, published on host `:${POSTGRES_HOST_PORT}`.
- Environment injected into the web container: `NODE_ENV=development`, the Docker-internal `DATABASE_URL` (the `postgres` service on the compose network), and a `SESSION_SECRET` placeholder reserved for future auth wiring.
- Named volumes for `node_modules`, `.next`, and `prisma/generated` so the container's installs never collide with whatever you have installed on the host.

### Useful commands

```bash
docker compose logs -f web              # tail dev server output
docker compose exec web sh              # shell into the web container
docker compose exec web npm run simulate # stream events from inside the container
docker compose down                     # stop (data persists in the pgdata volume)
docker compose down -v                  # stop and wipe the database
```

Non-Docker development still works exactly as before — `npm run db:up` only starts the Postgres container, and `npm run dev` runs Next.js directly against `localhost:${POSTGRES_HOST_PORT}` using the host `DATABASE_URL` from `.env`.

---

## Production deployment (Railway)

The repo ships with a `railway.json` so a `git push` to the linked branch builds with Nixpacks (the dev `Dockerfile` is intentionally skipped — it runs `next dev` and is local-only), then starts the app with `npm run start:prod`, which runs `prisma migrate deploy` immediately before `next start`. Migrations therefore apply on every deploy without a separate release step.

### Required environment variables

| Variable | Source | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Postgres plugin | Reference it as `${{Postgres.DATABASE_URL}}` so the web service tracks the database connection string automatically. |
| `NODE_ENV` | Railway | Set to `production` automatically. Enables `Secure` session cookies and Prisma's quieter log level. |
| `SESSION_SECRET` | You | Forward-compat secret reserved for future session/CSRF signing. Not consumed by the current opaque-token auth, but set it now (e.g. `openssl rand -hex 32`) so a future change is just a re-deploy. |
| `PORT` | Railway | Injected automatically. `next start` binds to it without further config. |

### Setup steps

1. **Push the repo to GitHub** if it isn't there already.
2. **Create a new Railway project** → *Deploy from GitHub repo* → pick this repository. Railway provisions an empty web service.
3. **Add a Postgres database** → *+ New* → *Database* → *Add PostgreSQL*. Wait for it to provision.
4. **Set the web service variables** → open the web service → *Variables* tab:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference variable, no quotes)
   - `SESSION_SECRET` = your generated value
   - Leave `NODE_ENV` and `PORT` alone; Railway sets them.
5. **Deploy.** Railway picks up `railway.json`, runs `npm ci` (which fires `postinstall` → `prisma generate`) and `npm run build`, then starts the container with `npm run start:prod`. The first start applies all migrations against the new database.
6. **Seed the demo data (optional, one-shot).** From the web service's *Settings* tab pick *Run a command* (or `railway run` locally with the project linked) and execute `npm run db:seed`. Skip this if you intend to register your own users via `/login` after promoting one to `OWNER` directly in the database.
7. **Generate a public URL** → web service → *Settings* → *Networking* → *Generate Domain*. Visit it, sign in, create an API key under `/settings/api-keys`, and point any SDK/CLI at the new origin.

### Notes

- `next start` already listens on `0.0.0.0:$PORT`, so no extra flags are needed.
- The build container has access to the Postgres private network, but migrations intentionally run in the start command — this keeps the build infrastructure-agnostic and makes a failed migration crash the deploy loudly rather than silently produce a green build against an unmigrated DB.
- `docker-compose.yml` and the local `Dockerfile` are ignored by Railway thanks to the `NIXPACKS` builder hint in `railway.json`; you can keep using them for local dev without affecting production.

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

## Integrating with another Next.js app

A copy-paste-friendly example lives in [`examples/nextjs-app/`](./examples/nextjs-app). It uses the local TypeScript client SDK at `packages/runtimecatch-client` and shows the two paths most apps actually want: reporting a successful event from a server action, and reporting a caught exception from a route handler.

The client needs four env vars:

| Variable | Example | Notes |
| --- | --- | --- |
| `RUNTIMECATCH_API_URL` | `http://localhost:3000` | Base URL of your RuntimeCatch instance |
| `RUNTIMECATCH_API_KEY` | `rc_live_…` | Project API key (`/settings/api-keys`) |
| `RUNTIMECATCH_SERVICE` | `playback-service` | Must exist in the API key's project |
| `RUNTIMECATCH_ENVIRONMENT` | `development` | Free-form label, stamped into metadata |

Configure once at module load, then capture from anywhere:

```ts
// lib/runtimecatch.ts
import "server-only";
import { configureRuntimeCatch } from "@runtimecatch/client";

configureRuntimeCatch({
  apiUrl: process.env.RUNTIMECATCH_API_URL!,
  apiKey: process.env.RUNTIMECATCH_API_KEY!,
  service: process.env.RUNTIMECATCH_SERVICE!,
  environment: process.env.RUNTIMECATCH_ENVIRONMENT ?? "development",
});

export { captureEvent, captureException } from "@runtimecatch/client";
```

```ts
// app/admin/actions.ts — successful server-action event
"use server";
import { captureEvent } from "@/lib/runtimecatch";

export async function publishPost(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  // … persist …
  await captureEvent("post.published", { title, userId: "usr_123" });
}
```

```ts
// app/api/widgets/route.ts — caught exception in a route handler
import { NextResponse } from "next/server";
import { captureException } from "@/lib/runtimecatch";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Missing `id` query param");
    return NextResponse.json({ id, name: "Example widget" });
  } catch (err) {
    await captureException(err, { route: "GET /api/widgets", url: request.url });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

The SDK isn't on npm yet — either vendor `packages/runtimecatch-client/dist/{index.js,index.d.ts}` into your app and re-point the imports, or install via a local path (`npm install file:…`). The example's `README.md` walks through both.

---

## CLI — `runtimecatch`

A small, dependency-free developer CLI for wiring a service into RuntimeCatch and firing test events without hand-writing curl. It's TypeScript (`cli/index.ts`) run through the locally-installed `tsx` — no build step, not published to npm.

```bash
runtimecatch init          # create / update .runtimecatchrc.json
runtimecatch env           # print current config (API key masked)
runtimecatch test          # send a simple INFO event to /api/events
runtimecatch send-error    # send a sample ERROR event with stackTrace + metadata
runtimecatch help          # list commands
```

To get the `runtimecatch` command on your PATH, run `npm link` once in this repo (it's declared as a `bin`, so `npm link` symlinks it globally). Prefer not to link? Every command also works through the package script — `npm run cli -- <command>` (e.g. `npm run cli -- test`).

`init` prompts for and writes `.runtimecatchrc.json` in the current directory (gitignored — it holds an API key):

```json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "rc_live_demo_key_for_local_testing_only",
  "service": "playback-service",
  "environment": "development"
}
```

`init` also accepts flags, which skip the matching prompt (handy for scripts / non-TTY shells):

```bash
runtimecatch init \
  --api-url http://localhost:3000 \
  --api-key rc_live_demo_key_for_local_testing_only \
  --service playback-service \
  --environment development
```

`test` and `send-error` POST to `${apiUrl}/api/events` with `Authorization: Bearer ${apiKey}`, using `service` from the config and stamping `environment` into the event's `metadata`. They print the request URL, HTTP status, and the JSON response (or the error body on a non-2xx). `env` prints the same config with the key masked (`rc_l…only (39 chars)`) so you can sanity-check it without leaking it into a terminal log.

Quick end-to-end check against the local stack:

```bash
npm run db:up && npm run db:migrate && npm run db:seed   # seeds the demo key + services
npm run dev                                              # in one terminal
npm link                                                 # once, to get `runtimecatch` on PATH
runtimecatch init                                        # apiKey: rc_live_demo_key_for_local_testing_only, service: playback-service
runtimecatch test                                        # → 201, then watch it land on the dashboard
runtimecatch send-error
```

### Troubleshooting

**`captureEvent` returns 200 from your app but nothing appears on the dashboard.**
The SDK swallows delivery errors by default, so a 4xx from `/api/events` shows up as a silent no-op. The most common cause is a stale `EventCategory` enum — `APP_EVENT` (used by `captureEvent`) was added in migration `20260513200000_add_app_event_category`. If your local DB predates that migration, run `npm run db:migrate` (or `npx prisma migrate reset --force` if you don't mind losing data) and the seed will repopulate the demo project.

To surface the underlying failure while debugging, pass `swallowErrors: false` to `configureRuntimeCatch` — the next bad payload throws instead of silently failing.

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
| `npm run cli -- <cmd>` | `runtimecatch` developer CLI without a global link (`init` / `env` / `test` / `send-error`) |

---

## License

MIT — see [LICENSE](./LICENSE).
