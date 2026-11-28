// P-29 / P-31 loading state (GEN-16): shown while the server asks the backend for the posts.
import { PublicShell } from "@/components/layout/public-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PublicShell>
      <div className="grid gap-6" aria-busy="true" aria-label="Loading posts">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    </PublicShell>
  );
}
