"use client";

// CommentItem
// Part: T4 Blog
// Requirements: BLG-05, BLG-07, ACC-12
// Used by: P-30
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <CommentItem comment={c} viewer={{ id, role }} onUpdated={(c) => ...} onDeleted={() => ...} />
// One comment: author, date, text (BLG-05). The comment's own author can edit it (inline, max 500 characters,
// PATCH /api/comments/{id}) and delete it after a confirmation (GEN-03, DELETE /api/comments/{id}) (BLG-07).
// Others can report it (GEN-09; a guest goes to login and back, ACC-10). Admins get Hide / Delete (GEN-10).
// ACC-12: the backend sends a deactivated author's name as "Deleted user"; it is shown as such, without a link.
import { useState, type FormEvent } from "react";
import { PencilLineIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormField } from "@/components/app/form-field";
import { ReportButton } from "@/components/app/report-button";
import { AdminContentActions } from "@/components/app/shared/admin-content-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import type { Role } from "@/lib/session";

/** openapi PostDetailComment (GET /api/posts/{id}) */
export type PostComment = {
  id: string;
  author: { id: string; name: string };
  text: string;
  date: string;
};

/** Who is looking: null = guest. */
export type CommentViewer = { id: string; role: Role } | null;

/** BLG-05: a comment is non-empty (not only spaces) and at most 500 characters. */
export const COMMENT_MAX_LENGTH = 500;

/** The frontend copy of the backend's comment rule; undefined when the text is fine. */
export function commentError(text: string): string | undefined {
  if (!text.trim()) return "Write something first.";
  if (text.length > COMMENT_MAX_LENGTH) return `Keep it under ${COMMENT_MAX_LENGTH} characters.`;
  return undefined;
}

type CommentItemProps = {
  comment: PostComment;
  viewer: CommentViewer;
  /** False while the viewer is not known yet: no buttons are shown. */
  viewerKnown?: boolean;
  onUpdated?: (comment: PostComment) => void;
  onDeleted?: () => void;
};

export function CommentItem({ comment, viewer, viewerKnown = true, onUpdated, onDeleted }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  // The text shown: the saved edit right away, without waiting for the list to reload.
  const [text, setText] = useState(comment.text);
  const [draft, setDraft] = useState(comment.text);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const isMine = viewer !== null && viewer.id === comment.author.id;
  const canReport = viewerKnown && !isMine && (viewer === null || viewer.role === "user");
  const isAdmin = viewer?.role === "admin";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = commentError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const updated = await apiFetch<{ text: string }>(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "PATCH",
        json: { text: draft },
      });
      setText(updated.text);
      setDraft(updated.text);
      onUpdated?.({ ...comment, text: updated.text });
      setEditing(false);
      toast.success("Comment updated");
    } catch (err) {
      if (err instanceof ApiError) setError(fieldErrorMap(err.body).text ?? err.message);
      else setError("We couldn't save the comment. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await apiFetch(`/api/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't delete the comment. Check your connection and try again.");
      throw err; // keeps the dialog open
    }
    toast.success("Comment deleted");
    onDeleted?.();
  }

  function cancelEdit() {
    setDraft(text);
    setError(undefined);
    setEditing(false);
  }

  return (
    <article className="grid gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className={comment.author.name === "Deleted user" ? "font-semibold text-muted-foreground" : "font-semibold"}>
            {comment.author.name}
          </span>
          <span aria-hidden="true" className="text-subtle-foreground">
            ·
          </span>
          <time dateTime={comment.date} className="text-subtle-foreground">
            {formatDate(comment.date)}
          </time>
        </p>
        {canReport && !editing && <ReportButton contentType="comment" contentId={comment.id} look="icon" />}
      </div>

      {editing ? (
        <form onSubmit={save} className="grid gap-3">
          <FormField label="Edit your comment" name="text" required error={error} hint={`${draft.length} / ${COMMENT_MAX_LENGTH} characters`}>
            <Textarea value={draft} maxLength={COMMENT_MAX_LENGTH} onChange={(e) => setDraft(e.target.value)} autoFocus />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="break-words whitespace-pre-line">{text}</p>
      )}

      {viewerKnown && !editing && (isMine || isAdmin) && (
        <div className="flex flex-wrap gap-2">
          {isMine && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <PencilLineIcon /> Edit
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm">
                    <Trash2Icon /> Delete
                  </Button>
                }
                title="Delete this comment?"
                description="Your comment is removed from the post. This can't be undone."
                confirmLabel="Delete comment"
                onConfirm={remove}
              />
            </>
          )}
          {/* The API doesn't say whether a comment is hidden, so admins always start from "Hide" here. */}
          {isAdmin && !isMine && <AdminContentActions type="comment" id={comment.id} hidden={false} onDeleted={onDeleted} />}
        </div>
      )}
    </article>
  );
}
