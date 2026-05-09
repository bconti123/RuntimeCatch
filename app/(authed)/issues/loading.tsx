import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <div className="border-b border-zinc-800 bg-zinc-950/60 px-6 py-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <div className="p-6">
        <Skeleton className="mb-6 h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    </>
  );
}
