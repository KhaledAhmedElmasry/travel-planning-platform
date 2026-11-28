"use client";

// Reply box of one review (HTL-26, bonus): a "Reply" button that opens a small form.
// POST /api/reviews/{id}/reply { text } (1-1000 characters, one reply per review). The backend's message
// (for example "The review already has a reply", 409) is shown under the field (GEN-02); after success the page is
// refreshed, so the card shows the reply and this box disappears.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

const MAX = 1000;

export function ReviewReplyForm({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value === "") {
      setError("Write your reply.");
      return;
    }
    if (value.length > MAX) {
      setError(`Use at most ${MAX} characters.`);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await apiFetch(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, { method: "POST", json: { text: value } });
      toast.success("Reply sent");
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setError(fieldErrorMap(err.body).text ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Reply
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3">
      <FormField
        label="Your reply"
        name={`reply-${reviewId}`}
        required
        hint={`${text.length} / ${MAX}. Your reply is shown under the review on your public hotel page. One reply per review.`}
        error={error}
      >
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={submitting}>
          Send reply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={submitting}
          onClick={() => {
            setOpen(false);
            setText("");
            setError(undefined);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
