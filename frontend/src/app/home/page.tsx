// - Home (registered user): /home
// Part: Lead (foundation)
// Requirements: ACC-04 (role home)
// Endpoints: GET /api/flight-bookings, GET /api/hotel-bookings, GET /api/itineraries, GET /api/notifications
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (upcoming trips, unread notifications).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page -). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Home (registered user)</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
