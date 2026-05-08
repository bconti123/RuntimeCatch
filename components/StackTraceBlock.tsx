export function StackTraceBlock({ trace }: { trace: string | null | undefined }) {
  if (!trace) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
        No stack trace captured.
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/80 p-4 text-[12px] leading-relaxed text-zinc-300">
      <code className="font-mono">{trace}</code>
    </pre>
  );
}
