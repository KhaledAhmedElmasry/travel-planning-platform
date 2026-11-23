// P-13 Flight details: /flights/[id]
// Part: T1 Flights + itinerary list
// Requirements: FLT-17, GEN-06
// Endpoints: GET, PATCH /api/flights/{id}
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): public, but seats remaining change every minute (10-minute holds), so the data must be fresh on every request; add SEO metadata (public page).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-13). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Flight details</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
