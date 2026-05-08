# RuntimeCatch

A self-hostable observability platform for tracking runtime errors, service failures, and application health across distributed systems.

Collect runtime events, monitor service health, and investigate failures from a centralized dashboard.

RuntimeCatch currently includes the frontend dashboard shell and a Prisma-backed PostgreSQL data layer with realistic seed data for services, runtime events, issues, alerts, and deployments. The next milestone is wiring the dashboard to live database counts and an event ingestion API.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma 7** + **PostgreSQL 16** (via Docker Compose)
- **Recharts** for charts
- **Zod** for runtime validation
- **Docker** for local Postgres + production packaging (planned)

## Project layout

```
app/          Next.js routes, layouts, pages
components/   Reusable React UI
lib/          Server/client utilities (Prisma client, helpers)
prisma/       Prisma schema, migrations, seed
scripts/      Local maintenance scripts
types/        Shared TypeScript types
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

Open [http://localhost:3000](http://localhost:3000) to view the dashboard shell.

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

The connection string lives in `.env`:

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

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:*` | See [Database](#database) above |

## Roadmap

### Completed
- Next.js + Tailwind project
- Folder structure and static dashboard shell
- Prisma schema with observability models, enums, and indexes
- PostgreSQL via Docker Compose
- Realistic seed data

### Next
- DB-backed dashboard counts and charts
- Issue list + detail views

### Planned
- Event ingestion API
- Resolve / mute workflow
- Docker packaging
- Auth
- Slack / webhook notifications

## License

MIT — see [LICENSE](./LICENSE).
