// <EmptyState title="No trips yet" line="So empty! Let's plan something."
//             action={<Button asChild><Link href="/flights">Search flights</Link></Button>} />
// Every list or search that can come back empty shows this (GEN-04), with So3ad,
// a short title, her line and ONE action that gets the user going.
import type { ReactNode } from "react";
import { cn } from "cn";
import { So3ad, type So3adPose } from "@/components/app/so3ad";

type EmptyStateProps = {
  title: string;
  /** So3ad's speech line, e.g. "Nothing here... try other dates?" */
  line?: string;
  /** One sentence explaining what to do next. */
  description?: string;
  action?: ReactNode;
  pose?: So3adPose;
  /** Hide So3ad in tight spaces (table cells, dropdowns). */
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  line,
  description,
  action,
  pose = "sit",
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      {!compact && <So3ad pose={pose} size={140} />}
      <h2 className="text-h3 font-semibold">{title}</h2>
      {line && (
        <p className="rounded-2xl rounded-bl-sm border border-border bg-muted px-4 py-2 font-semibold">
          &ldquo;{line}&rdquo;
        </p>
      )}
      {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
