"use client";

import { useActionState } from "react";
import {
  createServiceAction,
  type CreateServiceState,
} from "./actions";

const initial: CreateServiceState = {};

export function NewServiceForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createServiceAction,
    initial
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-zinc-400">Project</span>
        <select
          name="projectId"
          defaultValue={state.values?.projectId ?? projects[0]?.id ?? ""}
          required
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
        <span className="text-zinc-400">Service name</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={state.values?.name ?? ""}
          placeholder="checkout-api"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
        />
        <span className="text-[11px] text-zinc-500">
          Letters, numbers, dashes, and underscores. Must be unique within the project.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-zinc-400">Environment</span>
        <select
          name="environment"
          defaultValue={state.values?.environment ?? "PRODUCTION"}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
        >
          <option value="PRODUCTION">production</option>
          <option value="STAGING">staging</option>
          <option value="DEVELOPMENT">development</option>
        </select>
      </label>

      <p className="text-xs text-zinc-500">
        Status defaults to <span className="text-emerald-300">healthy</span>{" "}
        until alerts or events update it.
      </p>

      {state.error ? (
        <p className="text-xs text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create service"}
      </button>
    </form>
  );
}
