"use client";

// P-30 Client Components (.md section 9 "Likes and Comments"). The post page is cached for everyone (ISR), so
// who is viewing is found out here, in the browser (GET /api/auth/me), once for the whole page:
// - PostActions: Like / unlike (BLG-06), Report (GEN-09), the author's Edit / Delete (BLG-04, GEN-03) and the
//   admin's Hide / Unhide / Delete (GEN-10). likedByMe comes from GET /api/posts/{id} sent WITH the session.
// - PostComments: the comments page from the URL (?commentsPage=2), read WITH the session so the viewer also
//   sees their own hidden comments (and admins all of them, GEN-10); add, edit, delete (BLG-05, BLG-07).
// A guest who tries to like, comment or report goes to login and comes back (ACC-10).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PencilLineIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { CommentViewer, PostComment } from "@/components/app/blog/comment-item";
import { COMMENTS_PAGE_SIZE, CommentsSection } from "@/components/app/blog/comments-section";
import { LikeButton } from "@/components/app/blog/like-button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ErrorState } from "@/components/app/error-state";
import { ReportButton } from "@/components/app/report-button";
import { AdminContentActions } from "@/components/app/shared/admin-content-actions";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import type { PostDetail } from "./post-view";

// ---------------------------------------------------------------------------------------------------------
// Who is viewing: `known` is false while loading; `viewer` is null for a guest.

type ViewerState = { known: boolean; viewer: CommentViewer };
const ViewerContext = createContext<ViewerState>({ known: false, viewer: null });

export function PostViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewerState>({ known: false, viewer: null });

  useEffect(() => {
    let cancelled = false;
    apiFetch<SessionUser>("/api/auth/me", { redirectOnAuthFail: false })
      .then((me) => !cancelled && setState({ known: true, viewer: { id: me.id, role: me.role } }))
      // 401 after a refresh attempt (or no connection): a guest.
      .catch(() => !cancelled && setState({ known: true, viewer: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  return <ViewerContext.Provider value={state}>{children}</ViewerContext.Provider>;
}

const useViewer = () => useContext(ViewerContext);

/** GET /api/posts/{id} WITH the session (likedByMe, the viewer's own hidden comments). */
function loadPost(postId: string, commentsPage = 1): Promise<PostDetail> {
  return apiFetch<PostDetail>(`/api/posts/${encodeURIComponent(postId)}?commentsPage=${commentsPage}`, {
    redirectOnAuthFail: false,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Like, report, author and admin buttons.

type PostActionsProps = {
  postId: string;
  authorId: string;
  likeCount: number;
  status: PostDetail["status"];
  /** true when an admin hid the post (only its author and admins can open it then, GEN-10). */
  hidden?: boolean;
  /** For tests; defaults to a full page load. */
  navigate?: (path: string) => void;
};

export function PostActions({
  postId,
  authorId,
  likeCount,
  status,
  hidden = false,
  navigate = (path) => window.location.assign(path),
}: PostActionsProps) {
  const { known, viewer } = useViewer();
  const [like, setLike] = useState<{ count: number; liked: boolean } | null>(null);
  const published = status === "published" && !hidden;
  const role = viewer?.role ?? null;
  const isAuthor = viewer !== null && viewer.id === authorId;

  useEffect(() => {
    if (!known || role !== "user" || !published) return;
    let cancelled = false;
    loadPost(postId)
      .then((p) => !cancelled && setLike({ count: p.likeCount, liked: Boolean(p.likedByMe) }))
      .catch(() => {
        // Keep the cached count; a click still works and shows any error.
      });
    return () => {
      cancelled = true;
    };
  }, [known, role, published, postId]);

  async function deletePost() {
    try {
      await apiFetch(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't delete the post. Check your connection and try again.");
      throw error; // keeps the dialog open
    }
    toast.success("The post was deleted");
    navigate("/my/posts");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {published && (
        <LikeButton
          postId={postId}
          likeCount={like?.count ?? likeCount}
          likedByMe={like?.liked ?? false}
          viewer={role === null ? "guest" : role === "user" ? "user" : "other"}
          disabled={!known}
          navigate={navigate}
        />
      )}
      {known && published && !isAuthor && (role === null || role === "user") && <ReportButton contentType="post" contentId={postId} />}
      {known && isAuthor && (
        <>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/my/posts/${encodeURIComponent(postId)}/edit`}>
              <PencilLineIcon /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2Icon /> Delete
              </Button>
            }
            title="Delete this post?"
            description="The post, its comments, likes and images are removed. This can't be undone."
            confirmLabel="Delete post"
            onConfirm={deletePost}
          />
        </>
      )}
      {known && role === "admin" && <AdminContentActions type="post" id={postId} hidden={hidden} onDeleted={() => navigate("/blog")} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Comments.

type PostCommentsProps = {
  postId: string;
  /** Page 1 of the comments from the cached page (shown until the viewer's own copy arrives). */
  initial: { comments: PostComment[]; commentCount: number };
  /** False for a hidden post: the list is shown, but no new comments. */
  canComment?: boolean;
};

export function PostComments({ postId, initial, canComment = true }: PostCommentsProps) {
  const { known, viewer } = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  const raw = Number(useSearchParams().get("commentsPage"));
  const page = Number.isInteger(raw) && raw >= 1 ? raw : 1;
  const [attempt, setAttempt] = useState(0);
  const key = `${page}-${attempt}-${known}`;
  const [loaded, setLoaded] = useState<{ key: string; page: number; comments: PostComment[]; commentCount: number } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!known) return; // wait: the backend answers each viewer differently (GEN-10)
    let cancelled = false;
    loadPost(postId, page)
      .then((p) => !cancelled && setLoaded({ key, page, comments: p.comments, commentCount: p.commentCount }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailed({ key, message: error instanceof ApiError ? error.message : "We couldn't load the comments. Check your connection and try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [known, postId, page, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const hrefFor = (p: number) => `${pathname}${p > 1 ? `?commentsPage=${p}` : ""}#comments`;

  if (failed?.key === key) {
    return (
      <section id="comments" aria-label="Comments" className="scroll-mt-24">
        <ErrorState title="Comments didn't load" message={failed.message} onRetry={reload} compact />
      </section>
    );
  }

  // While a page (re)loads, keep what is shown for that page: the last answer, else the cached page 1.
  const current = loaded?.page === page ? loaded : page === 1 ? initial : null;
  const commentCount = current?.commentCount ?? loaded?.commentCount ?? initial.commentCount;

  return (
    <CommentsSection
      postId={postId}
      comments={current?.comments ?? null}
      commentCount={commentCount}
      page={page}
      viewer={viewer}
      viewerKnown={known}
      canComment={canComment}
      hrefFor={hrefFor}
      returnTo={`${pathname}#comments`}
      onAdded={(newCount) => {
        // Oldest first: the new comment is on the last page.
        const last = Math.max(1, Math.ceil(newCount / COMMENTS_PAGE_SIZE));
        if (last === page) reload();
        else router.push(hrefFor(last));
      }}
      onDeleted={() => {
        if ((current?.comments.length ?? 0) <= 1 && page > 1) router.push(hrefFor(page - 1));
        else reload();
      }}
    />
  );
}
