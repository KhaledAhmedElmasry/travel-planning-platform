"use client";

// P-18 back link (GEN-14, GEN-15). Team leader (26 Nov): browser back, so the user returns to the exact
// hotel search; /hotels when the page was opened directly (no earlier page in this tab).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/hotels"
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-link hover:underline"
    >
      <ChevronLeftIcon className="size-4" aria-hidden="true" />
      Back
    </Link>
  );
}
