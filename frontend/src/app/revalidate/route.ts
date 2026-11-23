// B5: the backend calls this to refresh cached pages (ISR) when content is hidden, deleted,
// made private or its author is deactivated: P-28 /itineraries/[id], P-30 /blog/[id], P-32 /authors/[id].
// Part: Lead (foundation). Not under /api because /api/* is forwarded to the backend (next.config.ts).
// Requirements: GEN-10, ACC-12, ITN-20 (.md section 9 ISR)
// TODO: not built yet. Replace this stub.
export function POST() {
  return new Response(null, { status: 501 });
}
