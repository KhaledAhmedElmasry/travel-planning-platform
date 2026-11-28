// P-30 Post: /blog/[id]
// Part: T4 Blog
// Requirements: BLG-02, BLG-05, BLG-06, BLG-07, GEN-09, GEN-10
// Endpoints: GET, DELETE /api/posts/{id}; POST /api/posts/{id}/comments; PATCH, DELETE /api/comments/{id}; POST, DELETE /api/posts/{id}/like; GET /api/countries (country names for ItineraryCard)
// Rendering: ISR / Static + Client Components. Source: .md section 9 "Published Blog Post" and Source: .md section 9 "Likes and Comments"; add SEO metadata.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-30). Use a shell and kit components (frontend/README.md).
// Built (28 Nov): title, author (link to P-32), date, clickable tags, images, body, like count (BLG-02); the post
// is read WITHOUT cookies and cached with the tag post:<id>, which the backend refreshes when the post, its
// comments or likes change, or it is hidden or deleted (B5). Likes, comments, report, author and admin buttons
// are Client Components (post-interactions.tsx) that find out who is viewing in the browser. A draft or hidden
// post is a 404 here; the 404 boundary (not-found.tsx) then asks again with the session, so its author and
// admins still see it (GEN-10). GET /api/countries is not called: GET /api/posts/{id} doesn't return the
// attached itinerary (BLG-13 bonus), so there is no ItineraryCard to show yet (open question for the team leader).
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ISR_REVALIDATE_SECONDS, postTag } from "@/lib/cache-tags";
import { BACKEND_URL } from "@/lib/server/backend";
import { PostActions, PostComments, PostViewerProvider } from "./post-interactions";
import { PostView, type PostDetail } from "./post-view";

export const revalidate = 60; // = ISR_REVALIDATE_SECONDS (Next.js needs a literal here)

// No post is built ahead; each one is rendered on its first visit and then cached (Next.js 16 ISR).
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

/** The published post with page 1 of its comments, or null (404). Shared by the page and its metadata. */
const loadPost = cache(async (id: string): Promise<PostDetail | null> => {
  const res = await fetch(`${BACKEND_URL}/api/posts/${encodeURIComponent(id)}`, {
    next: { revalidate: ISR_REVALIDATE_SECONDS, tags: [postTag(id)] },
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Could not load the post (${res.status})`);
  return (await res.json()) as PostDetail;
});

/** The first ~160 characters of the body, on whole words (search engines show about that much). */
function summary(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  return `${flat.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const description = summary(post.body) || `A travel story by ${post.author.name}.`;
  return {
    title: post.title,
    description,
    keywords: post.tags,
    authors: [{ name: post.author.name, url: `/authors/${post.author.id}` }],
    alternates: { canonical: `/blog/${post.id}` },
    openGraph: {
      type: "article",
      siteName: "Yallaway",
      title: post.title,
      description,
      publishedTime: post.date,
      authors: [post.author.name],
      tags: post.tags,
      ...(post.images[0] ? { images: [{ url: post.images[0].url }] } : {}),
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) notFound();

  return (
    <PublicShell>
      <PostViewerProvider>
        <div className="mx-auto grid max-w-3xl gap-10">
          <PostView
            post={post}
            actions={<PostActions postId={post.id} authorId={post.author.id} likeCount={post.likeCount} status={post.status} />}
          />
          {/* The comments read ?commentsPage in the browser (useSearchParams needs a Suspense boundary). */}
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
            <PostComments postId={post.id} initial={{ comments: post.comments, commentCount: post.commentCount }} />
          </Suspense>
        </div>
      </PostViewerProvider>
    </PublicShell>
  );
}
