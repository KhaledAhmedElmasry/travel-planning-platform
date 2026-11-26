// The 404 message (GEN-16, spec section 3.12), shared by the app's 404 page and P-28's 404 boundary.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { So3ad } from "@/components/app/so3ad";

export function NotFoundMessage() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <So3ad pose="lost" size={160} />
      <p className="tabular text-sm font-semibold tracking-widest text-cyan uppercase">Error 404</p>
      <h1 className="text-3xl font-bold">We can&rsquo;t find that page</h1>
      <p className="rounded-2xl rounded-bl-sm border border-border bg-muted px-4 py-2 font-semibold">
        &ldquo;Even I got lost. Let&rsquo;s go home.&rdquo;
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
