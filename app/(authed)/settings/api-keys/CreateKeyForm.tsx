"use client";

import { useActionState, useEffect, useState } from "react";
import { createApiKeyAction, type CreateKeyState } from "./actions";

const initial: CreateKeyState = {};

export function CreateKeyForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createApiKeyAction,
    initial
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [state.plaintext]);

  if (projects.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No projects available. Seed the database to create the demo project.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Project</span>
          <select
            name="projectId"
            defaultValue={projects[0].id}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Key name</span>
          <input
            type="text"
            name="name"
            required
            placeholder="ci-pipeline"
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Creating…" : "Create key"}
          </button>
        </div>
      </form>

      {state.error ? (
        <p className="text-xs text-red-400">{state.error}</p>
      ) : null}

      {state.plaintext ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-emerald-200">
              Copy this key now — it won&apos;t be shown again.
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(state.plaintext!);
                setCopied(true);
              }}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/20"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <code className="mt-2 block break-all rounded-md bg-zinc-950/80 px-3 py-2 font-mono text-xs text-emerald-200">
            {state.plaintext}
          </code>
          <div className="mt-2 text-[11px] text-zinc-500">
            Stored prefix: <span className="font-mono">{state.prefix}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
