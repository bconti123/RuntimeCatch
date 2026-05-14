import "server-only";
import { configureRuntimeCatch } from "@runtimecatch/client";

/**
 * Configure the default RuntimeCatch client once, at module load.
 *
 * Importing this file anywhere on the server (a server action, route handler,
 * server component, instrumentation hook) is enough to make
 * `captureException` / `captureEvent` work from anywhere in the app.
 */
configureRuntimeCatch({
  apiUrl: process.env.RUNTIMECATCH_API_URL!,
  apiKey: process.env.RUNTIMECATCH_API_KEY!,
  service: process.env.RUNTIMECATCH_SERVICE!,
  environment: process.env.RUNTIMECATCH_ENVIRONMENT ?? "development",
});

export { captureEvent, captureException } from "@runtimecatch/client";
