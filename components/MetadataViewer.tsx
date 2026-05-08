type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[];

export function MetadataViewer({ data }: { data: unknown }) {
  if (data == null) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
        No metadata.
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/80 p-4 text-[12px] leading-relaxed">
      <code className="font-mono text-zinc-300">
        {JSON.stringify(data as Json, null, 2)}
      </code>
    </pre>
  );
}
