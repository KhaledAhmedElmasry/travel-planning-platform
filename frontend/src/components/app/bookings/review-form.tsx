"use client";

// ReviewForm + ReviewSection
// Part: Lead (foundation)
// Requirements: HTL-23 (GEN-03, GEN-16)
// Used by: P-23
// Spec: MILESTONE2_FRONTEND_SPEC.md P-23 "If Completed: Write review ..., then edit or delete it".
// <ReviewSection bookingId={booking.id} status={booking.status} review={booking.review} />
// - Confirmed: the hint "You can review your stay after check-out."; other statuses except Completed: nothing.
// - Completed without a review: the form (rating 1-5 + optional text up to 1000 characters),
//   POST /api/hotel-bookings/{id}/review.
// - Completed with a review (GET /api/hotel-bookings/{id} -> review): ReviewCard with Edit (back to the
//   form, PATCH /api/reviews/{id} with only the changed fields) and Delete (ConfirmDialog, DELETE /api/reviews/{id}).
// After each change: a toast and router.refresh(), so the page reads the review again.
// Texts decided by the team leader (24 Nov).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { ReviewCard, type HotelReview } from "@/components/app/shared/review-card";
import { StarRating } from "@/components/app/shared/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";

/** openapi HotelBookingDetails.review: the user's own review + `hidden` (an admin hid it, GEN-10). */
export type OwnReview = HotelReview & { hidden: boolean };

const MAX_TEXT = 1000;
const GENERIC_ERROR = "Something went wrong. Try again.";

/** The backend's message for 4xx, the generic text for network errors and 5xx. */
function errorText(err: unknown) {
  return err instanceof ApiError && err.status < 500 ? err.message : GENERIC_ERROR;
}

export function ReviewSection({ bookingId, status, review }: { bookingId: string; status: string; review: OwnReview | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (status !== "confirmed" && status !== "completed") return null;

  async function remove(id: string) {
    try {
      await apiFetch(`/api/reviews/${id}`, { method: "DELETE" });
    } catch (err) {
      toast.error(errorText(err));
      throw err; // keeps the dialog open
    }
    toast.success("Review deleted");
    router.refresh();
  }

  return (
    <section aria-labelledby="review-heading" className="grid gap-3">
      <h2 id="review-heading" className="text-lg font-semibold">
        Your review
      </h2>
      {status === "confirmed" ? (
        <p className="text-sm text-muted-foreground">You can review your stay after check-out.</p>
      ) : review && !editing ? (
        <ReviewCard
          review={review}
          hidden={review.hidden}
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <ConfirmDialog
                trigger={<Button variant="destructive">Delete</Button>}
                title="Delete your review?"
                description="Your rating is removed from the hotel's average. You can write a new review for this stay afterwards."
                confirmLabel="Delete review"
                onConfirm={() => remove(review.id)}
              />
            </>
          }
        />
      ) : (
        <ReviewForm
          key={review?.id ?? "new"}
          bookingId={bookingId}
          review={review}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </section>
  );
}

type ReviewFormProps = {
  bookingId: string;
  /** Given -> edit this review; null -> write a new one. */
  review: OwnReview | null;
  /** After a successful save (also when nothing changed in edit mode, without a request). */
  onDone: () => void;
  onCancel: () => void;
};

export function ReviewForm({ bookingId, review, onDone, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [text, setText] = useState(review?.text ?? "");
  const [ratingError, setRatingError] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (rating < 1) {
      setRatingError("Choose a rating from 1 to 5.");
      return;
    }
    setRatingError(undefined);
    const trimmed = text.trim();

    let request: () => Promise<unknown>;
    let success: string;
    if (review) {
      // PATCH: only the changed fields; an emptied text is sent as "" (removes it).
      const changes: { rating?: number; text?: string } = {};
      if (rating !== review.rating) changes.rating = rating;
      if (trimmed !== (review.text ?? "")) changes.text = trimmed;
      if (Object.keys(changes).length === 0) return onDone();
      request = () => apiFetch(`/api/reviews/${review.id}`, { method: "PATCH", json: changes });
      success = "Review updated";
    } else {
      request = () =>
        apiFetch(`/api/hotel-bookings/${bookingId}/review`, {
          method: "POST",
          json: trimmed ? { rating, text: trimmed } : { rating },
        });
      success = "Review posted";
    }

    setSubmitting(true);
    try {
      await request();
    } catch (err) {
      setError(errorText(err));
      return;
    } finally {
      setSubmitting(false);
    }
    toast.success(success);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {error && <FormErrorSummary message={error} errors={{}} />}
      <div className="grid gap-1.5">
        <span className="text-sm font-medium" aria-hidden="true">
          Rating
        </span>
        <StarRating value={rating} onChange={setRating} label="Rating" name="review-rating" />
        {ratingError && <p className="text-[13px] text-error">{ratingError}</p>}
      </div>
      <FormField label="Review (optional)" name="review-text" hint={`${text.length}/${MAX_TEXT}`}>
        <Textarea value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          {review ? "Save changes" : "Post review"}
        </Button>
        {review && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
