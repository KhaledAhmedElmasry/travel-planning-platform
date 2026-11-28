"use client";

// CommentsSection
// Part: T4 Blog
// Requirements: BLG-05, BLG-07
// Used by: P-30
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <CommentsSection postId={id} comments={post.comments} commentCount={post.commentCount} page={1}
//                  viewer={viewer} hrefFor={(p) => `?commentsPage=${p}#comments`} onAdded={...} onDeleted={...} />
// The comments of a post in chronological order, 10 per page (BLG-05, GEN-05; the page comes from the URL),
// each a CommentItem (edit / delete own, BLG-07). A registered user adds a comment: non-empty, at most 500
// characters, checked here and by the backend (POST /api/posts/{id}/comments, GEN-02). A guest gets a
// "Log in to comment" link that comes back to the comments (ACC-10). Empty list: an empty state (GEN-04).
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { CommentItem, COMMENT_MAX_LENGTH, commentError, type CommentViewer, type PostComment } from "@/components/app/blog/comment-item";
import { EmptyState } from "@/components/app/empty-state";
import { FormField } from "@/components/app/form-field";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { loginPath } from "@/lib/return-to";

/** Comments per page (GEN-05, openapi PostDetailResponse.comments "at most 10 entries"). */
export const COMMENTS_PAGE_SIZE = 10;

type CommentsSectionProps = {
  postId: string;
  /** The comments of this page; null while they load. */
  comments: PostComment[] | null;
  commentCount: number;
  page: number;
  viewer: CommentViewer;
  /** False while the viewer is not known yet (the page is cached for everyone). */
  viewerKnown: boolean;
  /** False for a draft or hidden post: comments can't be added (the backend allows them only on published posts). */
  canComment?: boolean;
  /** Link to another page of comments. */
  hrefFor: (page: number) => string;
  /** The path to come back to after login (ACC-10). */
  returnTo: string;
  /** After a new comment: the page shows the last page, where it is (chronological order). */
  onAdded: (newCount: number) => void;
  /** After a comment is deleted: reload the comments (an edit is shown in place). */
  onDeleted: () => void;
};

export function CommentsSection({
  postId,
  comments,
  commentCount,
  page,
  viewer,
  viewerKnown,
  canComment = true,
  hrefFor,
  returnTo,
  onAdded,
  onDeleted,
}: CommentsSectionProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const totalPages = Math.max(1, Math.ceil(commentCount / COMMENTS_PAGE_SIZE));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = commentError(text);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await apiFetch(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", json: { text } });
      setText("");
      toast.success("Comment posted");
      onAdded(commentCount + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError("Only registered travelers can comment.");
      else if (err instanceof ApiError) setError(fieldErrorMap(err.body).text ?? err.message);
      else setError("We couldn't post your comment. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="comments" aria-labelledby="comments-title" className="grid scroll-mt-24 gap-4">
      <h2 id="comments-title" className="flex items-center gap-2 text-xl font-semibold">
        <MessageCircleIcon className="size-5" aria-hidden="true" />
        Comments <span className="tabular text-muted-foreground">({commentCount})</span>
      </h2>

      {canComment && viewerKnown && viewer?.role === "user" && (
        <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <FormField label="Add a comment" name="text" required error={error} hint={`${text.length} / ${COMMENT_MAX_LENGTH} characters`}>
            <Textarea value={text} maxLength={COMMENT_MAX_LENGTH} onChange={(e) => setText(e.target.value)} placeholder="Share your thoughts or ask the author" />
          </FormField>
          <div>
            <Button type="submit" loading={busy}>
              Post comment
            </Button>
          </div>
        </form>
      )}
      {canComment && viewerKnown && viewer === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-muted-foreground">Log in to like, comment or report.</p>
          <Button asChild variant="secondary">
            <Link href={loginPath(returnTo)}>Log in to comment</Link>
          </Button>
        </div>
      )}

      {comments === null ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading comments">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : comments.length === 0 ? (
        commentCount > 0 ? (
          <EmptyState
            compact
            title="This page is empty"
            action={
              <Button asChild variant="secondary">
                <Link href={hrefFor(1)}>Go to the first comments</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState compact title="No comments yet" description={canComment ? "Be the first to share your thoughts." : undefined} />
        )
      ) : (
        <ol className="grid gap-3">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem
                comment={comment}
                viewer={viewer}
                viewerKnown={viewerKnown}
                onDeleted={onDeleted}
              />
            </li>
          ))}
        </ol>
      )}

      <PaginationBar page={page} totalPages={totalPages} total={commentCount} pageSize={COMMENTS_PAGE_SIZE} hrefFor={hrefFor} />
    </section>
  );
}
