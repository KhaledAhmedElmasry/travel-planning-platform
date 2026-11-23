// P-03, P-04 Change password: /account/password
// Part: Lead (foundation)
// Requirements: ACC-07a, ACC-13, ACC-08
// Endpoints: PATCH /api/auth/change-password
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone (requireUser also routes forced password changes here); the form is a Client Component.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-03, P-04). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Change password</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
