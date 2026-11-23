// P-01 Sign up: /signup
// Part: Lead (foundation)
// Requirements: ACC-01, ACC-02 (Bonus banner)
// Endpoints: POST /api/auth/register
// Rendering: Static + Client Component form. Not in .md section 9, decided by the team leader (23 Nov): same page for every visitor and no per-user data on the server, so it is prerendered; the form is a Client Component that submits from the browser (if it reads the URL with useSearchParams, wrap it in <Suspense>, Next.js 16 docs).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-01). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
