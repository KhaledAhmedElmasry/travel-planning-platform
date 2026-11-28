"use client";

// P-30 404 boundary, browser part (GEN-10: "Hidden content is visible only to its author and admins"; same
// pattern as P-28). The post page is cached for everyone and read WITHOUT cookies, so a draft or a hidden post
// is a 404 there. Here the browser asks GET /api/posts/{id} again WITH the session: the backend answers the
// author (drafts and hidden posts) and admins (hidden posts); everyone else keeps the 404.
// A draft shows a "Draft" badge with Edit / Delete; a published post that only the session can see is hidden
// (a "Hidden" badge, the comments without the form, and Unhide / Delete for admins).
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NotFoundMessage } from "@/components/app/not-found-message";
import { StatusBadge } from "@/components/app/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { PostActions, PostComments, PostViewerProvider } from "./post-interactions";
import { PostView, type PostDetail } from "./post-view";

export function PostFallback({ postId }: { postId: string }) {
  const [post, setPost] = useState<PostDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PostDetail>(`/api/posts/${encodeURIComponent(postId)}`, { redirectOnAuthFail: false })
      .then((found) => !cancelled && setPost(found))
      // 404 (or 400 for a bad id): not visible to this viewer.
      .catch(() => !cancelled && setPost(null));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (post === undefined) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (post === null) return <NotFoundMessage />;

  const draft = post.status === "draft";
  return (
    <PostViewerProvider>
      <div className="mx-auto grid max-w-3xl gap-10">
        <p role="status" className="rounded-lg border border-border bg-muted px-4 py-2 text-sm">
          {draft ? "This post is a draft. Only you can see it." : "This post is hidden. Only its author and admins can see it."}
        </p>
        <PostView
          post={post}
          badges={draft ? <StatusBadge kind="post" status="draft" /> : <StatusBadge kind="content" status="hidden" />}
          actions={<PostActions postId={post.id} authorId={post.author.id} likeCount={post.likeCount} status={post.status} hidden={!draft} />}
        />
        {!draft && (
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
            <PostComments postId={post.id} initial={{ comments: post.comments, commentCount: post.commentCount }} canComment={false} />
          </Suspense>
        )}
      </div>
    </PostViewerProvider>
  );
}

/** The not-found file gets no params: the id is the last part of /blog/{id}. */
export function PostFallbackFromUrl() {
  const id = usePathname()?.split("/").pop() ?? "";
  return <PostFallback postId={id} />;
}
