// P-05, P-06 Profile: /account
// Part: Lead (foundation)
// Requirements: ACC-09, ACC-11, ACC-12, GEN-12
// Endpoints: GET, PATCH, DELETE /api/users/me; GET /api/currencies
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; the edit form and the deactivate dialog are Client Components.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-05, P-06). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
