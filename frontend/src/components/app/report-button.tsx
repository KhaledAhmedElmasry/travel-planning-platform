"use client";

// Report a post, comment, review or itinerary (GEN-09): POST /api/reports with
// { contentType, contentId, reason } (reason up to 500 characters).
// <ReportButton contentType="post" contentId={post.id} />
// - guest (401): goes to login and comes back to this page (ACC-10);
// - already reported (409): shows "You already reported this" instead of an error;
// - not a registered user (403, admin/moderators): explains that only travelers report.
import { useState } from "react";
import { CheckIcon, FlagIcon } from "lucide-react";
import { toast } from "sonner";
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
import { FormField } from "@/components/app/form-field";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

export type ReportableType = "post" | "comment" | "review" | "itinerary";

type ReportButtonProps = {
  contentType: ReportableType;
  contentId: string;
  /** Start in the "already reported" state (when the page knows it). */
  alreadyReported?: boolean;
  /** "icon" for tight places (comment rows), "text" elsewhere. */
  look?: "text" | "icon";
};

const NOUN: Record<ReportableType, string> = {
  post: "post",
  comment: "comment",
  review: "review",
  itinerary: "itinerary",
};

export function ReportButton({ contentType, contentId, alreadyReported = false, look = "text" }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyReported);
  const noun = NOUN[contentType];

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-subtle-foreground">
        <CheckIcon className="size-4" aria-hidden="true" />
        You reported this {noun}
      </span>
    );
  }

  async function submit() {
    if (!reason.trim()) {
      setError("Tell us what is wrong with this " + noun + ".");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      // A guest (or an ended session) is sent to login and back to this page by apiFetch (ACC-10).
      await apiFetch("/api/reports", {
        method: "POST",
        json: { contentType, contentId, reason: reason.trim() },
      });
      setDone(true);
      setOpen(false);
      toast.success("Thanks. An admin will review your report.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setDone(true);
        setOpen(false);
        toast.info(`You already reported this ${noun}.`);
      } else if (error instanceof ApiError && error.status === 403) {
        setError("Only registered travelers can report content.");
      } else if (error instanceof ApiError) {
        setError(fieldErrorMap(error.body).reason ?? error.message);
      } else {
        setError("We couldn't send the report. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        {look === "icon" ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Report this ${noun}`}>
            <FlagIcon />
          </Button>
        ) : (
          <Button variant="ghost" size="sm">
            <FlagIcon /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Report this {noun}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            An admin will review it. You can report each {noun} once.
          </DialogDescription>
        </DialogHeader>
        <FormField label="What's wrong?" name="reason" required error={error} hint="Up to 500 characters.">
          <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="For example: spam, offensive language, false information" />
        </FormField>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
