"use client";

// P-28 buttons: Clone (ITN-21), Save to favourites (BON-02), Report (GEN-09).
// The page is cached for every visitor (ISR), so this asks GET /api/auth/me in the browser to know
// who is viewing, and for a registered user whether the itinerary is already saved
// (GET /api/favourites?type=itinerary&targetId=<id>).
// source: team leader decision 24 Nov - P-28 Clone: registered user -> toast "Copied to My itineraries" and
// /my/itineraries/{newId}; guest -> /login?returnTo=<this page> (ACC-10); admins and moderators: the backend
// refuses them (POST /api/itineraries/{id}/clone is @Roles(Role.User)), so no button.
import { useEffect, useState } from "react";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { ReportButton } from "@/components/app/report-button";
import { FavouriteButton } from "@/components/app/shared/favourite-button";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { loginPath } from "@/lib/return-to";
import type { Role, SessionUser } from "@/lib/session";

type Viewer = { role: Role | null; favouriteId: string | null };

export function ItineraryActions({
  itineraryId,
  navigate = (path) => window.location.assign(path),
}: {
  itineraryId: string;
  navigate?: (path: string) => void;
}) {
  const [viewer, setViewer] = useState<Viewer | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Viewer = { role: null, favouriteId: null };
      try {
        const me = await apiFetch<SessionUser>("/api/auth/me", { redirectOnAuthFail: false });
        next = { role: me.role, favouriteId: null };
        if (me.role === "user") {
          const saved = await apiFetch<{ items: { id: string }[] }>(
            `/api/favourites?type=itinerary&targetId=${itineraryId}`,
            { redirectOnAuthFail: false },
          ).catch(() => ({ items: [] }));
          next.favouriteId = saved.items[0]?.id ?? null;
        }
      } catch {
        // 401 after a refresh attempt: a guest.
      }
      if (!cancelled) setViewer(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [itineraryId]);

  if (viewer === undefined) return null;
  const { role, favouriteId } = viewer;

  async function clone() {
    if (role === null) {
      navigate(loginPath(window.location.pathname + window.location.search));
      return;
    }
    setBusy(true);
    try {
      const copy = await apiFetch<{ id: string }>(`/api/itineraries/${itineraryId}/clone`, { method: "POST" });
      toast.success("Copied to My itineraries");
      navigate(`/my/itineraries/${copy.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't copy this itinerary. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(role === null || role === "user") && (
        <Button size="sm" onClick={clone} loading={busy}>
          <CopyIcon />
          Clone
        </Button>
      )}
      <FavouriteButton type="itinerary" targetId={itineraryId} favouriteId={favouriteId} role={role} navigate={navigate} />
      <ReportButton contentType="itinerary" contentId={itineraryId} />
    </div>
  );
}
