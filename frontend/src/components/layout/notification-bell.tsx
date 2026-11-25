"use client";

// Bell with the unread count, in the header of every logged-in role (GEN-01).
// The count comes from GET /api/notifications/unread-count (the shell's caller passes it in).
// Clicking opens a dropdown with the latest notifications (one page of GET /api/notifications,
// GEN-05), each with "Mark as read", and a "See all" link to the notifications page P-11
// (team leader, 24 Nov). "Mark all as read" is on P-11.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { NotificationItem, type AppNotification } from "@/components/app/shared/notification-item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api";

type BellProps = { unread?: number; className?: string };

export function NotificationBell(props: BellProps) {
  const router = useRouter();
  return <NotificationBellView {...props} navigate={(path) => router.push(path)} />;
}

type Loaded = { state: "loading" } | { state: "error"; message?: string } | { state: "ready"; items: AppNotification[] };

export function NotificationBellView({ unread = 0, className, navigate }: BellProps & { navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Loaded>({ state: "loading" });
  // Marked read here since the page was rendered; the server count catches up on the next page load.
  const [markedHere, setMarkedHere] = useState(0);
  const count = Math.max(0, unread - markedHere);
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  async function load() {
    setList({ state: "loading" });
    try {
      const page = await apiFetch<{ items: AppNotification[] }>("/api/notifications?page=1");
      setList({ state: "ready", items: page.items });
    } catch (error) {
      setList({ state: "error", message: error instanceof ApiError ? error.message : undefined });
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  function onRead(saved: AppNotification) {
    if (list.state !== "ready") return;
    if (list.items.some((item) => item.id === saved.id && !item.read)) setMarkedHere((m) => m + 1);
    setList({ state: "ready", items: list.items.map((item) => (item.id === saved.id ? saved : item)) });
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          "relative grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <BellIcon className="size-5" aria-hidden="true" />
        {count > 0 && (
          <span className="tabular absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Notifications" className="w-[min(24rem,calc(100vw-2rem))] gap-2 p-2">
        <div className="max-h-[60vh] overflow-y-auto">
          {list.state === "loading" && (
            <div className="grid gap-2 p-2" aria-label="Loading notifications">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          )}
          {list.state === "error" && <ErrorState compact className="py-4" message={list.message} onRetry={() => void load()} />}
          {list.state === "ready" && list.items.length === 0 && (
            <EmptyState compact title="No notifications yet" line="So empty! Let's plan something." />
          )}
          {list.state === "ready" && list.items.length > 0 && (
            <ul className="grid gap-1">
              {list.items.map((item) => (
                <NotificationItem
                  key={item.id}
                  notification={item}
                  onRead={onRead}
                  navigate={(path) => {
                    setOpen(false);
                    navigate(path);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="rounded-md border-t border-border p-2 text-center text-sm font-semibold text-link hover:underline"
        >
          See all
        </Link>
      </PopoverContent>
    </Popover>
  );
}
