// P-34 New post: /my/posts/new
// Part: T4 Blog
// Requirements: BLG-01, BLG-08, BLG-10, BLG-13 (Bonus)
// Endpoints: POST /api/posts; PATCH, DELETE /api/posts/{id}; POST /api/posts/{id}/images; DELETE /api/posts/{id}/images/{imageId}; PATCH /api/posts/{id}/itinerary
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Blog Editor / Drafts".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-34). Use a shell and kit components (frontend/README.md).
// Built (28 Nov): registered users only (requireUser: guests go to login and back, ACC-10; other roles get
// /forbidden). The form is PostEditor (Client Component): title, body, tags, images, Publish / Save as draft.
// BLG-13 picker: the author's itineraries come from GET /api/itineraries (ITN-03), read on the server; it is
// not in the endpoint list above, but the spec's picker of "the author's own itineraries" needs it.
import type { Metadata } from "next";
import { loadMyItineraries } from "@/components/app/blog/my-itineraries";
import { PostEditor } from "@/components/app/blog/post-editor";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "New post", robots: { index: false } };

export default async function Page() {
  const user = await requireUser(["user"]);
  const [itineraries, unreadNotifications] = await Promise.all([loadMyItineraries(), getUnreadCount()]);

  return (
    <AppShell user={user} unreadNotifications={unreadNotifications}>
      <div className="mx-auto grid max-w-3xl">
        <PageHeader
          title="New post"
          description="Share a travel story. Publish it now, or save it as a draft and finish it later."
          back={{ href: "/my/posts", label: "My posts" }}
        />
        <PostEditor itineraries={itineraries} />
      </div>
    </AppShell>
  );
}
