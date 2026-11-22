// The Yallaway wordmark (placeholder logo until a real one is drawn).
import Link from "next/link";
import { PlaneIcon } from "lucide-react";
import { cn } from "cn";

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="Yallaway home"
      className={cn("inline-flex items-center gap-2 rounded-md text-xl font-bold tracking-tight text-foreground", className)}
    >
      <PlaneIcon className="size-5 text-cyan" aria-hidden="true" />
      <span>
        Yalla<span className="text-cyan">way</span>
      </span>
    </Link>
  );
}
