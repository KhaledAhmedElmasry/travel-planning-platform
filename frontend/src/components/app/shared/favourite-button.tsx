"use client";

// FavouriteButton
// Part: Lead (foundation)
// Requirements: BON-02 (Bonus)
// Used by: P-18, P-28
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (24 Nov). <FavouriteButton type="hotel" targetId={hotel.id} favouriteId={savedId ?? null} role={user?.role ?? null} />
// - guest (role null): sees the button; a click goes to /login?returnTo=<this page> (team leader, 24 Nov; ACC-10);
// - registered user: toggles save (POST /api/favourites) / remove (DELETE /api/favourites/{id});
// - admins and moderators: nothing (BON-02 is for registered users; the backend refuses them).
// favouriteId: the page reads GET /api/favourites?type=<hotel|itinerary>&targetId=<id> (team leader, 24 Nov):
// items[0]?.id when the item is saved, else null (guests: null).
import { useState } from "react";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { loginPath } from "@/lib/return-to";
import type { Role } from "@/lib/session";

type FavouriteButtonProps = {
  type: "hotel" | "itinerary";
  targetId: string;
  favouriteId: string | null;
  role: Role | null;
  navigate?: (path: string) => void;
};

export function FavouriteButton({
  type,
  targetId,
  favouriteId: initialId,
  role,
  navigate = (path) => window.location.assign(path),
}: FavouriteButtonProps) {
  const [favouriteId, setFavouriteId] = useState(initialId);
  const [busy, setBusy] = useState(false);
  if (role !== null && role !== "user") return null;
  const saved = favouriteId !== null;

  async function toggle() {
    if (role === null) {
      navigate(loginPath(window.location.pathname + window.location.search));
      return;
    }
    setBusy(true);
    try {
      if (favouriteId !== null) {
        await apiFetch(`/api/favourites/${favouriteId}`, { method: "DELETE" });
        setFavouriteId(null);
      } else {
        const created = await apiFetch<{ id: string }>("/api/favourites", { method: "POST", json: { type, targetId } });
        setFavouriteId(created.id);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't update your favourites. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" aria-pressed={saved} onClick={toggle} loading={busy}>
      <HeartIcon className={cn(saved && "fill-current text-primary")} />
      Save to favourites
    </Button>
  );
}
