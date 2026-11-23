// P-14 Book a flight: /flights/[id]/book
// Part: T1 Flights + itinerary list
// Requirements: FLT-19, FLT-21, FLT-22, FLT-08, FLT-12, PAY-02
// Endpoints: POST /api/flight-bookings, POST /api/flight-bookings/hold, GET/POST /api/bookings/flight/{id}/policies|accept-policies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-14). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Book a flight</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
