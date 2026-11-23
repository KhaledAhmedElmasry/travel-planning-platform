// P-18 Hotel details: /hotels/[id]
// Part: T2 Hotels + my posts list
// Requirements: HTL-02, HTL-15, HTL-24, GEN-09
// Endpoints: GET /api/hotels/{id}, GET /api/hotels/{id}/rooms/available, GET /api/hotels/{id}/reviews
// Rendering: Dynamic SSR. Not in .md section 9, decided by the team leader (23 Nov): public, but the free rooms depend on the dates in the URL and change with every hold, so the data must be fresh on every request; add SEO metadata (public page).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-18). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Hotel details</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
