// P-19 Book a hotel: /hotels/[id]/book
// Part: T2 Hotels + my posts list
// Requirements: HTL-16, HTL-18, HTL-09, PAY-02
// Endpoints: POST, GET /api/hotel-bookings; GET /api/bookings/{type}/{id}/policies; POST /api/bookings/{type}/{id}/accept-policies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the multi-step form and the 10-minute hold countdown run in the browser.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-19). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Book a hotel</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
