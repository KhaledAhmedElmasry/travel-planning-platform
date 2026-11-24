"use client";

// AdminContentActions
// Part: Lead (foundation)
// Requirements: GEN-10
// Used by: P-18, P-28, P-30, P-52
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (24 Nov). Show it to admins only (the backend checks too, GEN-13):
//   <AdminContentActions type="post" id={post.id} hidden={post.hidden} onHiddenChange={...} onDeleted={() => router.push("/blog")} />
// - Hide: dialog with an optional reason -> PATCH /api/admin/content/{type}/{id}/hide { reason? } (team leader, 24 Nov)
// - Unhide (on hidden content): PATCH .../unhide
// - Delete: confirmation (GEN-03) -> DELETE /api/admin/content/{type}/{id}; the page decides where to go (onDeleted).
import { useState } from "react";
import { EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";

export type ModeratedContentType = "post" | "comment" | "review" | "itinerary";

type AdminContentActionsProps = {
  type: ModeratedContentType;
  id: string;
  hidden: boolean;
  onHiddenChange?: (hidden: boolean) => void;
  onDeleted?: () => void;
};

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "That didn't work. Check your connection and try again.");
}

export function AdminContentActions({ type, id, hidden: initialHidden, onHiddenChange, onDeleted }: AdminContentActionsProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const [shownProp, setShownProp] = useState(initialHidden);
  if (shownProp !== initialHidden) {
    // the page re-rendered with a newer value (e.g. after router.refresh()): follow it
    setShownProp(initialHidden);
    setHidden(initialHidden);
  }
  const [hideOpen, setHideOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/admin/content/${type}/${id}`;

  async function setVisibility(hide: boolean) {
    setBusy(true);
    try {
      const trimmed = reason.trim();
      await apiFetch(`${base}/${hide ? "hide" : "unhide"}`, {
        method: "PATCH",
        ...(hide ? { json: trimmed ? { reason: trimmed } : {} } : {}),
      });
      setHidden(hide);
      setHideOpen(false);
      setReason("");
      onHiddenChange?.(hide);
      toast.success(hide ? `The ${type} is hidden` : `The ${type} is visible again`);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await apiFetch(base, { method: "DELETE" });
    } catch (error) {
      showError(error);
      throw error; // keeps the dialog open
    }
    toast.success(`The ${type} was deleted`);
    onDeleted?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hidden ? (
        <Button variant="secondary" size="sm" onClick={() => setVisibility(false)} loading={busy}>
          <EyeIcon /> Unhide
        </Button>
      ) : (
        <Dialog open={hideOpen} onOpenChange={(next) => !busy && setHideOpen(next)}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm">
              <EyeOffIcon /> Hide
            </Button>
          </DialogTrigger>
          <DialogContent className="gap-5 p-6 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Hide this {type}?</DialogTitle>
              <DialogDescription className="text-muted-foreground">Only its author and admins will see it.</DialogDescription>
            </DialogHeader>
            <FormField label="Reason (optional)" name="reason" hint="Up to 500 characters.">
              <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </FormField>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setHideOpen(false)} disabled={busy}>
                Go back
              </Button>
              <Button onClick={() => setVisibility(true)} loading={busy}>
                Hide {type}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm">
            <Trash2Icon /> Delete
          </Button>
        }
        title={`Delete this ${type}?`}
        description={`The ${type} is removed for everyone. This can't be undone.`}
        confirmLabel={`Delete ${type}`}
        onConfirm={remove}
      />
    </div>
  );
}
