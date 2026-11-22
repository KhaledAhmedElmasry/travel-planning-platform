"use client";

// Ask before every destructive action (GEN-03).
// <ConfirmDialog
//   trigger={<Button variant="destructive">Cancel booking</Button>}
//   title="Cancel this booking?"
//   description="Nile Air refunds 100%: $1,005.00 back to your card. This can't be undone."
//   confirmLabel="Cancel booking"
//   cancelLabel="Keep booking"
//   onConfirm={async () => { await cancelBooking(id); }}
// />
// While onConfirm runs, the button shows a spinner and the dialog stays open;
// it closes when onConfirm finishes. If onConfirm throws, it stays open so the
// page can show the error (toast.error) and the user can retry or back out.
import { useState, type ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  /** Say exactly what happens, including money (refund amount) when there is any. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "destructive" (default) for delete/cancel, "default" for non-destructive confirmations. */
  tone?: "destructive" | "default";
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  tone = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="gap-5 p-6 data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="sm:place-items-start sm:text-left">
          {tone === "destructive" && (
            <span className="mb-1 grid size-10 place-items-center rounded-full bg-error/15 text-error">
              <TriangleAlertIcon className="size-5" aria-hidden="true" />
            </span>
          )}
          <AlertDialogTitle className="text-h3 font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" disabled={busy}>
            {cancelLabel}
          </AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) so the dialog stays open while saving. */}
          <Button variant={tone} loading={busy} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
