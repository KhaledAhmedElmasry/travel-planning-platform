"use client";

// AttachItineraryPicker
// Part: T4 Blog
// Requirements: BLG-13 (Bonus)
// Used by: P-34
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <AttachItineraryPicker itineraries={mine} value={choice} onChange={setChoice} keepOption />
// "Attach itinerary" (BLG-13): a select of the author's own itineraries (GET /api/itineraries, the page reads
// them). The post editor sends the choice with PATCH /api/posts/{id}/itinerary { itineraryId } when the post is
// saved: an id attaches it, NO_ITINERARY detaches (itineraryId: null), KEEP_ITINERARY sends nothing.
// keepOption: GET /api/posts/{id} doesn't say which itinerary is attached, so when editing a post the default is
// "keep the current one" instead of a guess.
import { FormField } from "@/components/app/form-field";
import type { ItinerarySummary } from "@/components/app/shared/itinerary-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDay } from "@/lib/dates";

/** Detach: PATCH .../itinerary { itineraryId: null }. */
export const NO_ITINERARY = "none";
/** Leave the attachment as it is (no request). */
export const KEEP_ITINERARY = "keep";

type AttachItineraryPickerProps = {
  /** The author's itineraries; null when they couldn't be loaded. */
  itineraries: ItinerarySummary[] | null;
  value: string;
  onChange: (value: string) => void;
  /** Offer "Keep the current itinerary" (editing an existing post). */
  keepOption?: boolean;
  error?: string;
  disabled?: boolean;
};

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

export function AttachItineraryPicker({ itineraries, value, onChange, keepOption = false, error, disabled = false }: AttachItineraryPickerProps) {
  const unavailable = itineraries === null;
  const hint = unavailable
    ? "Your itineraries couldn't be loaded. Reload the page to try again."
    : itineraries.length === 0
      ? "You have no itineraries yet. Create one in My itineraries to attach it."
      : "One of your own itineraries.";

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || unavailable || itineraries.length === 0}>
      <FormField label="Attach an itinerary (optional)" name="itineraryId" error={error} hint={hint}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="No itinerary" />
        </SelectTrigger>
      </FormField>
      <SelectContent>
        {keepOption && <SelectItem value={KEEP_ITINERARY}>Keep the current itinerary</SelectItem>}
        <SelectItem value={NO_ITINERARY}>No itinerary</SelectItem>
        {(itineraries ?? []).map((it) => (
          <SelectItem key={it.id} value={it.id}>
            {it.title} · {formatDay(it.startDate)} · {days(it.numberOfDays)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
