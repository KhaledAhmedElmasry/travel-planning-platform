// RoomSelectionList
// Part: T2 Hotels + my posts list
// Requirements: HTL-15
// Used by: P-18
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import Link from "next/link";
import { BedDoubleIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Price } from "@/components/app/price";
import { Button } from "@/components/ui/button";

export type AvailableRoom = {
  id: string;
  roomNumber: string;
  type: string;
  beds: number;
  maxOccupancy: number;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
  currency: string;
  checkIn: string;
  checkOut: string;
};

type RoomSelectionListProps = {
  hotelId: string;
  rooms: AvailableRoom[];
  query: string;
};

export function RoomSelectionList({ hotelId, rooms, query }: RoomSelectionListProps) {
  if (rooms.length === 0) {
    return (
      <EmptyState
        title="No rooms available"
        line="Nothing here... try other dates?"
        description="Choose another check-in or check-out date to see available rooms."
        pose="shrug"
      />
    );
  }

  return (
    <div className="grid gap-4">
      {rooms.map((room) => (
        <article key={room.id} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <BedDoubleIcon className="size-5 text-subtle-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold">{room.type}</h3>
            </div>
            <p className="text-muted-foreground">
              Room {room.roomNumber} · {room.beds} {room.beds === 1 ? "bed" : "beds"} · up to {room.maxOccupancy} guests
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{room.checkIn} to {room.checkOut}</span>
              <span>{room.nights} {room.nights === 1 ? "night" : "nights"}</span>
            </div>
          </div>
          <div className="grid gap-2 justify-items-start sm:justify-items-end">
            <Price cents={room.totalPrice} currency={room.currency} size="lg" />
            <span className="text-sm text-muted-foreground">Total stay</span>
            <Button asChild>
              <Link href={`/hotels/${encodeURIComponent(hotelId)}/book?${query}&roomId=${encodeURIComponent(room.id)}`}>
                Select room
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
