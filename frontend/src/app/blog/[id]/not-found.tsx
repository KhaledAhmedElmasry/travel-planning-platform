// P-30 404 boundary: shown when /blog/{id} is a draft, hidden, deleted or unknown. The HTTP status stays 404
// and the page is not indexed (Next.js not-found). The browser then asks the backend again with the session,
// so the author still sees their draft or hidden post and admins see hidden posts (GEN-10, same as P-28).
// Rendering: Static shell + Client Component (the session is only known in the browser on this cached page).
import { PublicShell } from "@/components/layout/public-shell";
import { PostFallbackFromUrl } from "./post-fallback";

export default function NotFound() {
  return (
    <PublicShell>
      <PostFallbackFromUrl />
    </PublicShell>
  );
}
