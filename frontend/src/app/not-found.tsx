// 404 page for every unknown URL (GEN-16, spec section 3.12).
// Rendering: Static (a Server Component by default, Next.js 16 docs). Not in .md section 9: the same 404 page for everyone.
import { NotFoundMessage } from "@/components/app/not-found-message";
import { PublicShell } from "@/components/layout/public-shell";

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundMessage />
    </PublicShell>
  );
}
