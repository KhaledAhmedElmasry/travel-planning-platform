// RoomForm
// Part: T6 Hotel dashboard
// Requirements: HTL-03, HTL-05
// Used by: P-43
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (27 Nov). Add a room (no `room`): POST /api/hotels/{id}/rooms. Edit (with `room`): PATCH .../rooms/{roomId}
// with beds, maximum occupancy and price; room number and type cannot change after creation (openapi).
// Price: the moderator types the amount (e.g. 120.50) and it is sent as integer cents (PAY-04).
// Errors: under each field (GEN-02); a duplicate room number (409) is shown under "Room number or name".
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

/** One item of GET /api/hotels/{id}/rooms (openapi HotelRoomListItem). Prices are integer cents. */
export type HotelRoom = {
  id: string;
  roomNumber: string;
  type: string;
  beds: number;
  maxOccupancy: number;
  pricePerNight: number;
  currency: string;
  active: boolean;
  availableRanges: { from: string; to: string }[];
  blockedRanges: { from: string; to: string }[];
  everReserved: boolean;
};

type Errors = { message?: string; fields: Record<string, string> };

const LABELS = {
  roomNumber: "Room number or name",
  type: "Room type",
  beds: "Beds",
  maxOccupancy: "Maximum guests",
  pricePerNight: "Price per night",
};

/** "120.5" -> 12050; null when it is not an amount above 0 with at most 2 decimals. */
function toCents(value: string): number | null {
  const text = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents > 0 ? cents : null;
}

function wholeNumber(value: string): number | null {
  const number = Number(value);
  return value.trim() !== "" && Number.isInteger(number) && number >= 1 ? number : null;
}

type RoomFormProps = {
  hotelId: string;
  /** Present when editing. */
  room?: HotelRoom;
  /** Platform currency, shown in the price hint (taken from the existing rooms). */
  currency?: string;
  onDone: () => void;
  onCancel: () => void;
};

export function RoomForm({ hotelId, room, currency, onDone, onCancel }: RoomFormProps) {
  const [roomNumber, setRoomNumber] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState(room ? String(room.beds) : "");
  const [maxOccupancy, setMaxOccupancy] = useState(room ? String(room.maxOccupancy) : "");
  const [price, setPrice] = useState(room ? (room.pricePerNight / 100).toFixed(2) : "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);

  const base = `/api/hotels/${encodeURIComponent(hotelId)}/rooms`;
  const code = room?.currency ?? currency;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    if (!room) {
      if (roomNumber.trim() === "") fields.roomNumber = "Enter a room number or name.";
      else if (roomNumber.trim().length > 20) fields.roomNumber = "Use at most 20 characters.";
      if (type.trim() === "") fields.type = "Enter the room type, for example Deluxe double.";
      else if (type.trim().length > 50) fields.type = "Use at most 50 characters.";
    }
    const bedsValue = wholeNumber(beds);
    const occupancyValue = wholeNumber(maxOccupancy);
    const cents = toCents(price);
    if (bedsValue === null) fields.beds = "Enter a whole number, 1 or more.";
    if (occupancyValue === null) fields.maxOccupancy = "Enter a whole number, 1 or more.";
    if (cents === null) fields.pricePerNight = "Enter an amount above 0, with at most 2 decimals.";
    if (bedsValue === null || occupancyValue === null || cents === null || Object.keys(fields).length > 0) {
      setErrors({ fields });
      return;
    }

    setErrors(null);
    setSubmitting(true);
    try {
      if (room) {
        await apiFetch(`${base}/${encodeURIComponent(room.id)}`, {
          method: "PATCH",
          json: { beds: bedsValue, maxOccupancy: occupancyValue, pricePerNight: cents },
        });
        toast.success("Room saved");
      } else {
        await apiFetch(base, {
          method: "POST",
          json: {
            roomNumber: roomNumber.trim(),
            type: type.trim(),
            beds: bedsValue,
            maxOccupancy: occupancyValue,
            pricePerNight: cents,
          },
        });
        toast.success("Room added. Add bookable dates so guests can book it.");
      }
      onDone();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const mapped = fieldErrorMap(err.body);
      if (err.status === 409 && !room) mapped.roomNumber = err.message;
      setErrors({ message: err.message, fields: mapped });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors && <FormErrorSummary message={errors.message} errors={errors.fields} labels={LABELS} />}
      {room ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium text-foreground">Room {room.roomNumber}</p>
          <p className="text-sm text-muted-foreground">{room.type} Â· number and type cannot be changed</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Room number or name" name="roomNumber" required error={errors?.fields.roomNumber}>
            <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} maxLength={20} />
          </FormField>
          <FormField label="Room type" name="type" required error={errors?.fields.type}>
            <Input value={type} onChange={(e) => setType(e.target.value)} maxLength={50} />
          </FormField>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Beds" name="beds" required error={errors?.fields.beds}>
          <Input type="number" inputMode="numeric" min={1} step={1} value={beds} onChange={(e) => setBeds(e.target.value)} />
        </FormField>
        <FormField label="Maximum guests" name="maxOccupancy" required error={errors?.fields.maxOccupancy}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={maxOccupancy}
            onChange={(e) => setMaxOccupancy(e.target.value)}
          />
        </FormField>
      </div>
      <FormField
        label={code ? `Price per night (${code})` : "Price per night"}
        name="pricePerNight"
        required
        hint={room ? "A new price does not change existing reservations." : undefined}
        error={errors?.fields.pricePerNight}
      >
        <Input inputMode="decimal" placeholder="120.00" value={price} onChange={(e) => setPrice(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {room ? "Save changes" : "Add room"}
        </Button>
      </div>
    </form>
  );
}
