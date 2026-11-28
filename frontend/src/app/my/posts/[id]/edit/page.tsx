// P-34 Edit post: /my/posts/[id]/edit
// Part: T4 Blog
// Requirements: BLG-04, BLG-08, BLG-10, BLG-13 (Bonus)
// Endpoints: GET, PATCH, DELETE /api/posts/{id}; POST /api/posts/{id}/images; DELETE /api/posts/{id}/images/{imageId}; PATCH /api/posts/{id}/itinerary
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Blog Editor / Drafts".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-34). Use a shell and kit components (frontend/README.md).
// Built (28 Nov): registered users only (requireUser). The post is read WITH the session (drafts and hidden posts
// are visible to their author); someone else's post or an unknown id shows the 404 page (the backend also refuses
// edits by others, 403). PostEditor (Client Component): edit title, body, tags (BLG-08), images (BLG-10),
// Publish / Save as draft, Delete with a confirmation (BLG-04, GEN-03).
// BLG-13 picker: the author's itineraries come from GET /api/itineraries (ITN-03), read on the server; it is not
// in the endpoint list above, but the spec's picker of "the author's own itineraries" needs it.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadMyItineraries } from "@/components/app/blog/my-itineraries";
import { PostEditor, type EditablePost } from "@/components/app/blog/post-editor";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit post", robots: { index: false } };

type PostDetail = EditablePost & { author: { id: string; name: string } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["user"]);
  const { id } = await params;
  const [post, itineraries, unreadNotifications] = await Promise.all([
    backendJson<PostDetail>(`/api/posts/${encodeURIComponent(id)}`),
    loadMyItineraries(),
    getUnreadCount(),
  ]);
  // Unknown, deleted, or someone else's post: only the author edits a post (BLG-04).
  if (!post || post.author.id !== user.id) notFound();

  return (
    <AppShell user={user} unreadNotifications={unreadNotifications}>
      <div className="mx-auto grid max-w-3xl">
        <PageHeader
          title="Edit post"
          description={<StatusBadge kind="post" status={post.status} />}
          back={{ href: "/my/posts", label: "My posts" }}
          actions={
            post.status === "published" && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/blog/${encodeURIComponent(post.id)}`}>View post</Link>
              </Button>
            )
          }
        />
        {/* key: after router.refresh() (draft saved) the form starts again from the saved post. */}
        <PostEditor
          key={`${post.status}-${post.title}-${post.tags.join(",")}-${post.images.length}`}
          post={{ id: post.id, title: post.title, body: post.body, tags: post.tags, images: post.images, status: post.status }}
          itineraries={itineraries}
        />
      </div>
    </AppShell>
  );
}
