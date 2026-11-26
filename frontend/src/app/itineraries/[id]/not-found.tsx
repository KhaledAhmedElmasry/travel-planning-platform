// P-28 404 boundary: shown when /itineraries/{id} is private, hidden, deleted or unknown. The HTTP status
// stays 404 and the page is not indexed (Next.js not-found). For a HIDDEN itinerary, the browser then asks
// the backend again with the session, so its author and admins can still see it (GEN-10, team leader 26 Nov).
// Rendering: Static shell + Client Component (the session is only known in the browser on this cached page).
import { PublicShell } from "@/components/layout/public-shell";
import { HiddenItineraryFromUrl } from "./hidden-itinerary-fallback";

export default function NotFound() {
  return (
    <PublicShell>
      <HiddenItineraryFromUrl />
    </PublicShell>
  );
}
