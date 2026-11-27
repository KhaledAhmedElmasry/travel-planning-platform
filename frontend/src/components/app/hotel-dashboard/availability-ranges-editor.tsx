"use client";

// AvailabilityRangesEditor
// Part: T6 Hotel dashboard
// Requirements: HTL-04, HTL-05, HTL-06
// Used by: P-44
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (27 Nov). <AvailabilityRangesEditor hotelId={id} room={room} />
// Left: the room's bookable ranges (each can be removed, GEN-03 confirm) and blocked ranges (each can be unblocked).
// Right: one form for any dates: add bookable dates (POST), remove bookable dates, block, unblock (PATCH action).
// `from` and `to` are the first and the last night, both included. The backend's 400/409 message (for example the
// nights that have reservations) is shown under the dates field (GEN-02) or as a toast for the quick buttons (GEN-16).
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DateRangePicker, type DateRangeValue } from "@/components/app/date-range-picker";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDay, nightsBetween, todayString } from "@/lib/dates";

/** The part of an item of GET /api/hotels/{id}/rooms (openapi HotelRoomListItem) that P-44 uses. */
export type RoomWithRanges = {
  id: string;
  roomNumber: string;
  type: string;
  active: boolean;
  availableRanges: { from: string; to: string }[];
  blockedRanges: { from: string; to: string }[];
};

type Range = { from: string; to: string };
type Kind = "add" | "remove" | "block" | "unblock";

const ACTIONS: { value: Kind; label: string; hint: string; done: string; button: string }[] = [
  {
    value: "add",
    label: "Add bookable dates",
    hint: "Nights guests can book. Bookable ranges cannot overlap.",
    done: "Bookable dates added",
    button: "Add dates",
  },
  {
    value: "remove",
    label: "Remove bookable dates",
    hint: "Nights with a Confirmed or Pending Payment reservation cannot be removed.",
    done: "Bookable dates removed",
    button: "Remove dates",
  },
  {
    value: "block",
    label: "Block dates",
    hint: "Blocked nights cannot be booked. Refused when a Confirmed or Pending Payment reservation overlaps.",
    done: "Dates blocked",
    button: "Block dates",
  },
  {
    value: "unblock",
    label: "Unblock dates",
    hint: "Opens blocked nights again.",
    done: "Dates unblocked",
    button: "Unblock dates",
  },
];

function describe(range: Range): string {
  const nights = nightsBetween(range.from, range.to) + 1;
  const when = range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} â€“ ${formatDay(range.to)}`;
  return `${when} Â· ${nights} ${nights === 1 ? "night" : "nights"}`;
}

function RangeList({
  title,
  empty,
  ranges,
  action,
}: {
  title: string;
  empty: string;
  ranges: Range[];
  action: (range: Range) => ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {ranges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {ranges.map((range) => (
            <li
              key={`${range.from}-${range.to}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span className="tabular text-sm">{describe(range)}</span>
              {action(range)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AvailabilityRangesEditor({ hotelId, room }: { hotelId: string; room: RoomWithRanges }) {
  const router = useRouter();
  const url = `/api/hotels/${encodeURIComponent(hotelId)}/rooms/${encodeURIComponent(room.id)}/availability`;
  const [kind, setKind] = useState<Kind>("add");
  const [range, setRange] = useState<DateRangeValue>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const current = ACTIONS.find((item) => item.value === kind) ?? ACTIONS[0];

  async function send(action: Kind, body: Range) {
    if (action === "add") await apiFetch(url, { method: "POST", json: body });
    else await apiFetch(url, { method: "PATCH", json: { action, ...body } });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!range.from || !range.to) {
      setError("Choose the first and the last night.");
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await send(kind, { from: range.from, to: range.to });
      toast.success(current.done);
      setRange({});
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  /** Quick buttons of the lists: the toast shows the backend's message, and a ConfirmDialog stays open on failure. */
  async function quick(action: Kind, target: Range, success: string) {
    try {
      await send(action, target);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save the change. Try again.");
      throw err;
    }
    toast.success(success);
    router.refresh();
  }

  async function unblock(target: Range) {
    const key = `${target.from}-${target.to}`;
    setBusyKey(key);
    try {
      await quick("unblock", target, "Dates unblocked");
    } catch {
      // the toast already shows the error
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="grid content-start gap-8">
        <RangeList
          title="Bookable dates"
          empty="No bookable dates yet. Guests cannot book this room until you add some."
          ranges={room.availableRanges}
          action={(target) => (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="secondary">
                  Remove
                </Button>
              }
              title="Remove these bookable dates?"
              description={`${describe(target)} can no longer be booked. It is refused when a Confirmed or Pending Payment reservation falls inside.`}
              confirmLabel="Remove dates"
              cancelLabel="Keep dates"
              onConfirm={() => quick("remove", target, "Bookable dates removed")}
            />
          )}
        />
        <RangeList
          title="Blocked dates"
          empty="No blocked dates."
          ranges={room.blockedRanges}
          action={(target) => (
            <Button
              size="sm"
              variant="secondary"
              loading={busyKey === `${target.from}-${target.to}`}
              onClick={() => unblock(target)}
            >
              Unblock
            </Button>
          )}
        />
      </div>

      <form onSubmit={onSubmit} noValidate className="grid content-start gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Change dates</h2>
        {/* Select outside FormField: FormField labels its direct child, which must be the trigger button. */}
        <Select
          value={kind}
          onValueChange={(value) => {
            setKind(value as Kind);
            setError(undefined);
          }}
        >
          <FormField label="What do you want to do?" name="action">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {ACTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormField
          label="Nights"
          name="dates"
          required
          hint={`${current.hint} The first and the last night are both included.`}
          error={error}
        >
          <DateRangePicker value={range} onChange={setRange} min={todayString()} minNights={0} showNights={false} />
        </FormField>
        <Button type="submit" loading={submitting} className="justify-self-start">
          {current.button}
        </Button>
      </form>
    </div>
  );
}
