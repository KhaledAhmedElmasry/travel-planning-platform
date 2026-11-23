// P-17 Booking confirmed: /checkout/[type]/[bookingId]/done
// Part: Lead (foundation)
// Requirements: FLT-23, HTL-17
// Endpoints: GET /api/flight-bookings/{id}; GET /api/flight-bookings/{id}/e-ticket; GET /api/hotel-bookings/{id}
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (the booking reference); closest .md section 9 row: "User Booking Pages".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-17). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Booking confirmed</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
