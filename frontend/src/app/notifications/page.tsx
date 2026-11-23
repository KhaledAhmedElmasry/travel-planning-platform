// P-11 Notifications: /notifications
// Part: Lead (foundation)
// Requirements: GEN-01
// Endpoints: GET /api/notifications; PATCH /api/notifications/read-all; PATCH /api/notifications/{id}/read
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone and must be fresh; mark-as-read buttons are Client Components.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-11). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
