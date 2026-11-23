// P-16 Payment: /checkout/[type]/[bookingId]
// Part: Lead (foundation)
// Requirements: PAY-01
// Endpoints: POST /api/payments, POST /api/payments/{id}/retry, GET /api/payments/{id}
// Rendering: Dynamic SSR + Client Components. Not in .md section 9, decided by the team leader (23 Nov): per-user data read with the session cookie on every request, so it can't be cached for everyone; Stripe Elements must run in the browser so card data never reaches the backend (PAY-01).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-16). Use a shell and kit components (frontend/README.md).
// TODO: not built yet. Replace this stub.
export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Payment</h1>
      <p className="text-muted-foreground">Not built yet.</p>
    </main>
  );
}
