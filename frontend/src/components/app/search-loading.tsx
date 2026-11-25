// <SearchLoading />
// Shown while flight or hotel search results load (GEN-16 loading state): So3ad scrolling
// on her phone with her line (MASTER.md section 9). Use it in the search page's loading.tsx
// or while the results request runs.
import { cn } from "cn";
import { So3ad } from "@/components/app/so3ad";

export function SearchLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <So3ad pose="scroll" size={140} />
      <p role="status" className="rounded-2xl rounded-bl-sm border border-border bg-muted px-4 py-2 font-semibold">
        &ldquo;Hold on, I&rsquo;m haggling for you&hellip;&rdquo;
      </p>
    </div>
  );
}
