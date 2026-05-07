# RuntimeCatch

A self-hostable observability platform for tracking runtime errors, service failures, and application health across distributed systems.

Collect runtime events, monitor service health, and investigate failures from a centralized dashboard.

RuntimeCatch currently includes the frontend dashboard shell and foundational application architecture. The next milestone is adding PostgreSQL, Prisma models, event ingestion, and error grouping.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma** + **PostgreSQL** (planned)
- **Recharts** for charts
- **Zod** for runtime validation
- **Docker** for local Postgres + production packaging (planned)

## Project layout

```
app/          Next.js routes, layouts, pages
components/   Reusable React UI
lib/          Server/client utilities (db client, helpers)
prisma/       Prisma schema and migrations (planned)
scripts/      Local maintenance / seed scripts
types/        Shared TypeScript types
```

## Setup

Requires Node.js 20+ and npm.

```bash
git clone https://github.com/bconti123/RuntimeCatch.git
cd RuntimeCatch
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard shell.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |

## Roadmap

### Completed
- Next.js + Tailwind project
- Folder structure
- Static dashboard shell

### Next
- Prisma schema
- PostgreSQL with Docker Compose
- Seed data
- DB-backed dashboard counts

### Planned
- Event ingestion API
- Error grouping
- Issue detail view
- Resolve / mute workflow
- Docker packaging
- Auth
- Slack/webhook notifications

## License

MIT — see [LICENSE](./LICENSE).
