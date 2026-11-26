import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-40" />
      </div>
    </main>
  );
}
