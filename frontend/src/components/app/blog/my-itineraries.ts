// SERVER ONLY. The logged-in author's own itineraries for the BLG-13 (Bonus) picker on P-34:
// every page of GET /api/itineraries (ITN-03, 10 per page). null when they can't be read, so the
// editor still works and the picker says it couldn't load them.
import type { ItinerarySummary } from "@/components/app/shared/itinerary-card";
import { allPages } from "@/lib/all-pages";
import { backendJson } from "@/lib/server/backend";

type ItineraryPage = { items: ItinerarySummary[]; totalPages: number };

export async function loadMyItineraries(): Promise<ItinerarySummary[] | null> {
  try {
    return await allPages(async (page) => {
      const res = await backendJson<ItineraryPage>(`/api/itineraries?page=${page}`);
      if (!res) throw new Error("Could not load the itineraries");
      return res;
    });
  } catch {
    return null;
  }
}
