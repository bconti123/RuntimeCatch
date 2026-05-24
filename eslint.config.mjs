import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone copy-paste SDK sample; not part of the deployed app and
    // already excluded from typecheck (see tsconfig `exclude`). Keeping lint
    // aligned means an example-only edit can't break the main app's CI.
    "examples/**",
    // Prisma's generated client.
    "prisma/generated/**",
  ]),
]);

export default eslintConfig;
