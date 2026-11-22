// Bell with the unread count, in the header of every logged-in role (GEN-01).
// The count comes from GET /api/notifications/unread-count (the shell's caller
// passes it in). Clicking opens the notifications page (P-11).
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { cn } from "cn";

export function NotificationBell({ unread = 0, className }: { unread?: number; className?: string }) {
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className={cn(
        "relative grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      {unread > 0 && (
        <span className="tabular absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
