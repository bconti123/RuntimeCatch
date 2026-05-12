#!/usr/bin/env node
// `runtimecatch` executable wrapper.
//
// The CLI itself is TypeScript (cli/index.ts); this thin launcher runs it
// through the locally-installed `tsx` so there's no build step. It resolves
// `tsx` relative to this file, so it works from any working directory once
// the package is on PATH (`npm link`, or installed as a dependency).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const tsxBin = join(dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
const entry = join(here, "index.ts");

const result = spawnSync(process.execPath, [tsxBin, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
