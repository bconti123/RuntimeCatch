"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-zinc-400">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          defaultValue="owner@runtimecatch.dev"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-zinc-400">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/40"
        />
      </label>
      {state.error ? (
        <p className="text-xs text-red-400">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
