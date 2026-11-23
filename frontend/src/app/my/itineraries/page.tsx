// P-24 My itineraries: /my/itineraries
// Part: T1 Flights + itinerary list
// Requirements: ITN-03
// Endpoints: GET /api/itineraries
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (private itineraries); same reason as .md section 9 "Private Itinerary Detail".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-24). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">My itineraries</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
