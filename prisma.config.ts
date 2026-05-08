import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env or run `docker compose up -d`."
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
