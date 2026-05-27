/**
 * Continuously generates realistic runtime events into the database.
 *
 *   npm run simulate              # every 2-5s, runs forever
 *   SIMULATE_INTERVAL_MS=500 npm run simulate
 *   SIMULATE_DURATION_MS=30000 npm run simulate   # auto-exit after 30s
 *
 * Writes directly via Prisma (no HTTP) so it works without the dev server.
 * Scenario pool and ingestion logic live in ./event-source.ts (shared with the
 * one-shot backfill). To exercise the ingestion API instead, see the README.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client/client";
import {
  renderEvent,
  resolveProject,
  makeServiceResolver,
  ingestEvent,
} from "./event-source";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const intervalMs = Number(process.env.SIMULATE_INTERVAL_MS ?? 0);
  const durationMs = Number(process.env.SIMULATE_DURATION_MS ?? 0);
  const startedAt = Date.now();

  const project = await resolveProject(prisma);
  const resolveService = makeServiceResolver(prisma, project.id);

  console.log(
    `[simulate] streaming events${
      intervalMs > 0 ? ` every ${intervalMs}ms` : " every 2-5s (jittered)"
    }${durationMs > 0 ? `, stopping after ${durationMs}ms` : ", press Ctrl+C to stop"}`
  );

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    console.log("\n[simulate] stopping…");
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  while (!stopping) {
    if (durationMs > 0 && Date.now() - startedAt >= durationMs) break;
    const event = renderEvent();
    try {
      await ingestEvent(prisma, resolveService, event, new Date());
      console.log(
        `[simulate] ${event.service.padEnd(24)} ${event.severity.padEnd(8)} ${event.category.padEnd(16)} ${event.message}`
      );
    } catch (err) {
      console.error("[simulate] failed to ingest event:", err);
    }
    const wait =
      intervalMs > 0 ? intervalMs : 2000 + Math.floor(Math.random() * 3000);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
