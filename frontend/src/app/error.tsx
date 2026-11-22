"use client";

// Shown when a page crashes while rendering (GEN-16). Offers a retry and a way home.
// A page that loads data should still handle its own errors with <ErrorState>.
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/app/error-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4">
      <div className="grid justify-items-center gap-2">
        <ErrorState
          title="This page ran into a problem"
          message="Something broke on our side. Try again, or go back to the home page."
          onRetry={reset}
        />
        <Button asChild variant="link">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
