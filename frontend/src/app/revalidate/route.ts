// B5: the backend calls this to refresh cached pages (ISR) when content is hidden, deleted,
// made private or its author is deactivated: P-28 /itineraries/[id], P-30 /blog/[id], P-32 /authors/[id].
// Part: Lead (foundation). Not under /api because /api/* is forwarded to the backend (next.config.ts).
// Requirements: GEN-10, ACC-12, ITN-20 (.md section 9 ISR)
// Contract (team leader, 23 Nov): POST { tags: ["post:<id>", "itinerary:<id>", "author:<id>"] } with
// the header x-revalidate-secret = REVALIDATE_SECRET (same value in backend/.env and
// frontend/.env.local). 401 without the right secret, 400 for a bad body, 200 { revalidated }.
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { isCacheTag } from "@/lib/cache-tags";

function sameSecret(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!sameSecret(request.headers.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
    return Response.json({ message: "Not allowed" }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  const tags = (body as { tags?: unknown } | null)?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every(isCacheTag)) {
    return Response.json({ message: "tags must be a non-empty list of post:, itinerary: or author: tags" }, { status: 400 });
  }
  // expire 0: hidden or private content must not be served again while the page refreshes.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags });
}
