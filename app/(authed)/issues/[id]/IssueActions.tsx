"use client";

import { useTransition } from "react";
import type { IssueStatus } from "@/prisma/generated/client/client";
import { setIssueStatus } from "./actions";

export function IssueActions({
  issueId,
  status,
}: {
  issueId: string;
  status: IssueStatus;
}) {
  const [pending, startTransition] = useTransition();

  const update = (next: IssueStatus) => {
    startTransition(() => {
      setIssueStatus(issueId, next);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {status !== "OPEN" ? (
        <button
          type="button"
          onClick={() => update("OPEN")}
          disabled={pending}
          className={btnClass}
        >
          Reopen
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => update("RESOLVED")}
            disabled={pending}
            className={primaryClass}
          >
            Resolve
          </button>
          <button
            type="button"
            onClick={() => update("MUTED")}
            disabled={pending}
            className={btnClass}
          >
            Mute
          </button>
          <button
            type="button"
            onClick={() => update("IGNORED")}
            disabled={pending}
            className={btnClass}
          >
            Ignore
          </button>
        </>
      )}
    </div>
  );
}

const btnClass =
  "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";

const primaryClass =
  "rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";
