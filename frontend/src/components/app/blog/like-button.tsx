"use client";

// LikeButton
// Part: T4 Blog
// Requirements: BLG-06
// Used by: P-30
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <LikeButton postId={post.id} likeCount={post.likeCount} likedByMe={post.likedByMe} viewer="user" />
// Like / unlike a published post, once per user, with the like count (BLG-06):
//   POST /api/posts/{id}/like -> { likeCount }, DELETE /api/posts/{id}/like -> { likeCount }.
// - viewer "guest": a click goes to login and back to this post (ACC-10, BLG-02);
// - viewer "other" (admin, moderators: the backend allows only registered users): the count only, no button;
// - 409 "already likes" / 404 "has not liked" (another tab changed it): the state follows the backend.
// The button shows a spinner while saving and an error toast if it fails (GEN-16).
import { useState } from "react";
import { ThumbsUpIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { loginPath } from "@/lib/return-to";

export type LikeViewer = "guest" | "user" | "other";

type LikeButtonProps = {
  postId: string;
  likeCount: number;
  likedByMe?: boolean;
  viewer: LikeViewer;
  /** Disabled while the viewer is not known yet, or when the post can't be liked (draft). */
  disabled?: boolean;
  /** For tests; defaults to a full page load (login). */
  navigate?: (path: string) => void;
};

const label = (n: number) => `${n} ${n === 1 ? "like" : "likes"}`;

export function LikeButton({
  postId,
  likeCount,
  likedByMe = false,
  viewer,
  disabled = false,
  navigate = (path) => window.location.assign(path),
}: LikeButtonProps) {
  const [state, setState] = useState({ count: likeCount, liked: likedByMe });
  const [shown, setShown] = useState({ likeCount, likedByMe });
  if (shown.likeCount !== likeCount || shown.likedByMe !== likedByMe) {
    // The page loaded newer values (e.g. the viewer's own like after the cached page): follow them.
    setShown({ likeCount, likedByMe });
    setState({ count: likeCount, liked: likedByMe });
  }
  const [busy, setBusy] = useState(false);

  if (viewer === "other") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ThumbsUpIcon className="size-4" aria-hidden="true" />
        {label(state.count)}
      </span>
    );
  }

  async function toggle() {
    if (viewer === "guest") {
      navigate(loginPath(window.location.pathname + window.location.search));
      return;
    }
    const like = !state.liked;
    setBusy(true);
    try {
      const res = await apiFetch<{ likeCount: number }>(`/api/posts/${encodeURIComponent(postId)}/like`, {
        method: like ? "POST" : "DELETE",
      });
      setState({ count: res.likeCount, liked: like });
    } catch (error) {
      if (error instanceof ApiError && like && error.status === 409) {
        setState((s) => ({ ...s, liked: true }));
      } else if (error instanceof ApiError && !like && error.status === 404) {
        setState((s) => ({ ...s, liked: false }));
      } else {
        toast.error(error instanceof ApiError ? error.message : "We couldn't save your like. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={state.liked ? "default" : "secondary"}
      size="sm"
      onClick={toggle}
      loading={busy}
      disabled={disabled}
      aria-pressed={state.liked}
      aria-label={`${state.liked ? "Unlike" : "Like"} this post (${label(state.count)})`}
    >
      <ThumbsUpIcon />
      <span className="tabular">{state.count}</span>
      <span className="hidden sm:inline">{state.liked ? "Liked" : "Like"}</span>
    </Button>
  );
}
