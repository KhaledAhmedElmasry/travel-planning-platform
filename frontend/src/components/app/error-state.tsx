"use client";

// <ErrorState message={error.message} onRetry={() => router.refresh()} />
// Shown when loading data fails (GEN-16): says what went wrong and offers a way out.
// For a failed ACTION (save, pay, cancel) use a toast instead: toast.error("...").
import { TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  /** The backend's message when there is one (the API error format has `message`). */
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this. Check your connection and try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-error/15 text-error">
        <TriangleAlertIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-prose text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
