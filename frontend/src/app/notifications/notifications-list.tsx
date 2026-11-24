"use client";

// P-11 list (GEN-01): one page of notifications, "Mark as read" per item and "Mark all as read"
// (PATCH /api/notifications/read-all). After a change the page is refreshed so the header badge
// (rendered on the server) shows the new unread count.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheckIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { NotificationItem, type AppNotification } from "@/components/app/shared/notification-item";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

type Props = { items: AppNotification[]; unread: number };

export function NotificationsSection(props: Props) {
  const router = useRouter();
  return <NotificationsList {...props} navigate={(path) => router.push(path)} refresh={() => router.refresh()} />;
}

export function NotificationsList({
  items: initial,
  unread,
  navigate,
  refresh,
}: Props & { navigate: (path: string) => void; refresh: () => void }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  if (items.length === 0) {
    return <EmptyState title="No notifications yet" line="So empty! Let's plan something." />;
  }

  async function markAll() {
    setBusy(true);
    try {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
      setItems((list) => list.map((item) => ({ ...item, read: true })));
      toast.success("All notifications marked as read");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't update your notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onRead(saved: AppNotification) {
    setItems((list) => list.map((item) => (item.id === saved.id ? saved : item)));
    refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={markAll} loading={busy} disabled={unread === 0}>
          <CheckCheckIcon /> Mark all as read
        </Button>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <NotificationItem key={item.id} notification={item} onRead={onRead} navigate={navigate} />
        ))}
      </ul>
    </div>
  );
}
