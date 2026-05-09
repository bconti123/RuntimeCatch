import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <div className="border-b border-zinc-800 bg-zinc-950/60 px-6 py-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    </>
  );
}
