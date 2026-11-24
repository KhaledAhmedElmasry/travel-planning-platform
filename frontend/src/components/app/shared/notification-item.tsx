"use client";

// NotificationItem
// Part: Lead (foundation)
// Requirements: GEN-01
// Used by: P-11, bell dropdown
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (24 Nov). One notification inside a <ul>: <NotificationItem notification={n} onRead={replace} navigate={router.push} />
// - "Mark as read" (unread only): PATCH /api/notifications/{id}/read, then onRead(saved notification);
// - clicking the notification marks it read (when unread) AND opens its link (team leader, 24 Nov);
//   only links on this site are followed (no open redirect).
// TODO(ask team leader): if marking as read fails when the user clicks the item, we show the error
// and still open the link (the user asked to go there). Keep that, or stay on the list?
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { safeReturnTo } from "@/lib/return-to";

/** GET /api/notifications item (backend notifications.service.ts NotificationItem). */
export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  readAt?: string;
  link?: string;
  createdAt: string;
};

type NotificationItemProps = {
  notification: AppNotification;
  onRead: (saved: AppNotification) => void;
  navigate: (path: string) => void;
};

export function NotificationItem({ notification: n, onRead, navigate }: NotificationItemProps) {
  const [busy, setBusy] = useState(false);

  async function markRead(): Promise<void> {
    setBusy(true);
    try {
      onRead(await apiFetch<AppNotification>(`/api/notifications/${n.id}/read`, { method: "PATCH" }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't update the notification. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    if (!n.read) await markRead();
    const link = safeReturnTo(n.link);
    if (link) navigate(link);
  }

  return (
    <li className={cn("flex items-start gap-3 rounded-lg p-3", !n.read && "bg-primary/10")}>
      <span
        aria-hidden="true"
        className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
      />
      <button type="button" onClick={open} disabled={busy} className="grid min-w-0 flex-1 gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
        <span className="font-semibold">
          {!n.read && <span className="sr-only">Unread</span>}
          {n.title}
        </span>
        <span className="text-sm text-muted-foreground">{n.message}</span>
        <span className="text-[13px] text-subtle-foreground">{formatDate(n.createdAt)}</span>
      </button>
      {!n.read && (
        <Button variant="ghost" size="sm" onClick={markRead} loading={busy}>
          Mark as read
        </Button>
      )}
    </li>
  );
}
