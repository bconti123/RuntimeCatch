#!/usr/bin/env node
/**
 * RuntimeCatch developer CLI.
 *
 * A tiny, dependency-free helper for wiring a service into RuntimeCatch:
 * stash connection details in `.runtimecatchrc.json`, then fire test events
 * at the ingestion API without hand-writing curl.
 *
 *   npm run cli -- init          # create .runtimecatchrc.json
 *   npm run cli -- env           # show current config (API key masked)
 *   npm run cli -- test          # send a simple INFO event
 *   npm run cli -- send-error    # send a sample ERROR event w/ stack + metadata
 *
 * Not published to npm yet — run it through the `cli` package script (tsx).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const RC_FILE = ".runtimecatchrc.json";
const RC_PATH = resolve(process.cwd(), RC_FILE);

type Config = {
  apiUrl: string;
  apiKey: string;
  service: string;
  environment: string;
};

const DEFAULTS: Config = {
  apiUrl: "http://localhost:3000",
  apiKey: "",
  service: "",
  environment: "development",
};

function readConfig(): Config {
  if (!existsSync(RC_PATH)) {
    console.error(
      `No ${RC_FILE} found in ${process.cwd()}.\nRun \`npm run cli -- init\` first.`
    );
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(readFileSync(RC_PATH, "utf8")) as Partial<Config>;
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    console.error(`Could not parse ${RC_FILE}:`, (err as Error).message);
    process.exit(1);
  }
}

function maskKey(key: string): string {
  if (!key) return "(not set)";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} chars)`;
}

function requireKey(config: Config): asserts config is Config {
  if (!config.apiKey || !config.service) {
    console.error(
      `${RC_FILE} is missing \`apiKey\` and/or \`service\`. Run \`npm run cli -- init\`.`
    );
    process.exit(1);
  }
}

async function postEvent(
  config: Config,
  payload: Record<string, unknown>
): Promise<void> {
  const url = `${config.apiUrl.replace(/\/$/, "")}/api/events`;
  const body = {
    ...payload,
    metadata: {
      ...(payload.metadata as Record<string, unknown> | undefined),
      environment: config.environment,
      sentBy: "runtimecatch-cli",
    },
  };

  console.log(`→ POST ${url}`);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Request failed: ${(err as Error).message}`);
    console.error("Is the RuntimeCatch dev server running at", config.apiUrl, "?");
    process.exit(1);
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    console.error(`✗ ${res.status} ${res.statusText}`);
    console.error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    process.exit(1);
  }

  console.log(`✓ ${res.status} ${res.statusText}`);
  console.log(JSON.stringify(parsed, null, 2));
}

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      out[arg.slice(2)] = argv[++i] ?? "";
    }
  }
  return out;
}

async function cmdInit(): Promise<void> {
  const existing: Partial<Config> = existsSync(RC_PATH)
    ? (JSON.parse(readFileSync(RC_PATH, "utf8")) as Partial<Config>)
    : {};
  const flags = parseFlags(process.argv.slice(3));
  // Flag aliases: --api-url / --apiUrl, --api-key / --apiKey, --service, --environment / --env
  const flagFor = (...names: string[]): string | undefined => {
    for (const n of names) if (flags[n] !== undefined) return flags[n];
    return undefined;
  };

  // Interactive prompts only when stdin is a TTY and the value wasn't passed.
  const interactive = stdin.isTTY === true;
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
  if (existsSync(RC_PATH) && interactive) {
    console.log(`${RC_FILE} already exists — press Enter to keep current values.\n`);
  }

  const resolveField = async (
    label: string,
    flagValue: string | undefined,
    fallback: string
  ): Promise<string> => {
    if (flagValue !== undefined) return flagValue.trim() || fallback;
    if (!rl) return fallback;
    const answer = (await rl.question(`${label} [${fallback || "—"}]: `)).trim();
    return answer || fallback;
  };

  const config: Config = {
    apiUrl: await resolveField(
      "API URL",
      flagFor("api-url", "apiUrl"),
      existing.apiUrl ?? DEFAULTS.apiUrl
    ),
    apiKey: await resolveField(
      "API key (rc_live_…)",
      flagFor("api-key", "apiKey"),
      existing.apiKey ?? DEFAULTS.apiKey
    ),
    service: await resolveField(
      "Service name",
      flagFor("service"),
      existing.service ?? DEFAULTS.service
    ),
    environment: await resolveField(
      "Environment",
      flagFor("environment", "env"),
      existing.environment ?? DEFAULTS.environment
    ),
  };
  rl?.close();

  writeFileSync(RC_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${RC_FILE}:`);
  console.log(
    JSON.stringify({ ...config, apiKey: maskKey(config.apiKey) }, null, 2)
  );
  if (!config.apiKey || !config.service) {
    console.log(
      "\nHeads up: `apiKey` and/or `service` are blank — fill them in before sending events."
    );
  }
}

function cmdEnv(): void {
  const config = readConfig();
  console.log(`Config from ${RC_PATH}\n`);
  console.log(`  apiUrl       ${config.apiUrl}`);
  console.log(`  apiKey       ${maskKey(config.apiKey)}`);
  console.log(`  service      ${config.service || "(not set)"}`);
  console.log(`  environment  ${config.environment}`);
}

async function cmdTest(): Promise<void> {
  const config = readConfig();
  requireKey(config);
  await postEvent(config, {
    service: config.service,
    severity: "INFO",
    category: "RUNTIME_ERROR",
    message: "RuntimeCatch CLI connectivity test",
    metadata: { check: "test", at: new Date().toISOString() },
  });
}

async function cmdSendError(): Promise<void> {
  const config = readConfig();
  requireKey(config);
  await postEvent(config, {
    service: config.service,
    severity: "ERROR",
    category: "RUNTIME_ERROR",
    message: "Sample error from RuntimeCatch CLI: TypeError: cannot read 'id' of undefined",
    stackTrace: [
      "TypeError: Cannot read properties of undefined (reading 'id')",
      "    at resolveUser (/app/src/users/resolve.ts:42:18)",
      "    at handler (/app/src/routes/profile.ts:17:24)",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
    ].join("\n"),
    metadata: {
      route: "GET /profile",
      userId: null,
      release: "cli-sample",
    },
  });
}

const HELP = `RuntimeCatch CLI

Usage: runtimecatch <command>
  (no global install? run it via the package script: npm run cli -- <command>)

Commands:
  init         Create or update ${RC_FILE} (apiUrl, apiKey, service, environment)
                 flags: --api-url --api-key --service --environment
  env          Print the current config (API key masked)
  test         Send a simple INFO event to /api/events
  send-error   Send a sample ERROR event with a stack trace and metadata
  help         Show this message
`;

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "init":
      return cmdInit();
    case "env":
      return cmdEnv();
    case "test":
      return cmdTest();
    case "send-error":
      return cmdSendError();
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
