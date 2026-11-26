// RoomSelectionList
// Part: T2 Hotels + my posts list
// Requirements: HTL-15, GEN-05
// Used by: P-18
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <RoomSelectionList hotelId={id} rooms={allFreeRooms} checkIn="2027-03-01" checkOut="2027-03-04" />
// Every free room for the dates (HTL-15): type, beds, max occupancy, price per night, total stay price, and a
// checkbox. Team leader (26 Nov): all rooms are loaded, 10 per page (?roomsPage=N, the other query params kept),
// the checked rooms stay checked across pages, no limit on how many; "Book selected rooms" opens P-19 with
// /hotels/{id}/book?checkIn=&checkOut=&roomIds=id1,id2.
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BedDoubleIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Price } from "@/components/app/price";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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

const PAGE_SIZE = 10; // GEN-05

type RoomSelectionListProps = { hotelId: string; rooms: AvailableRoom[]; checkIn: string; checkOut: string };

export function RoomSelectionList({ hotelId, rooms, checkIn, checkOut }: RoomSelectionListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);

  if (rooms.length === 0) {
    return <EmptyState title="No rooms available" line="Nothing here... try other dates?" description="Choose another check-in or check-out date to see available rooms." pose="shrug" />;
  }

  const totalPages = Math.ceil(rooms.length / PAGE_SIZE);
  const asked = Number(searchParams.get("roomsPage"));
  const page = Number.isInteger(asked) && asked >= 1 && asked <= totalPages ? asked : 1;
  const shown = rooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hrefFor = (p: number) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("roomsPage", String(p));
    return `?${query}`;
  };
  const toggle = (id: string, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((x) => x !== id)));
  const book = () => {
    // Rooms in list order, so P-19 shows them the same way.
    const roomIds = rooms.filter((r) => selected.includes(r.id)).map((r) => r.id).join(",");
    router.push(`/hotels/${encodeURIComponent(hotelId)}/book?${new URLSearchParams({ checkIn, checkOut, roomIds })}`);
  };

  return (
    <div className="grid gap-4">
      {shown.map((room) => {
        const checkboxId = `room-${room.id}`;
        return (
          <article key={room.id} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
            <Checkbox id={checkboxId} checked={selected.includes(room.id)} onCheckedChange={(v) => toggle(room.id, v === true)} aria-labelledby={`${checkboxId}-label`} />
            <div className="grid gap-2">
              <label id={`${checkboxId}-label`} htmlFor={checkboxId} className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                <BedDoubleIcon className="size-5 text-subtle-foreground" aria-hidden="true" />
                Room {room.roomNumber} · {room.type}
              </label>
              <p className="text-muted-foreground">
                {room.beds} {room.beds === 1 ? "bed" : "beds"} · up to {room.maxOccupancy} {room.maxOccupancy === 1 ? "guest" : "guests"}
              </p>
              <p className="text-sm text-muted-foreground">
                {room.nights} {room.nights === 1 ? "night" : "nights"} · <Price cents={room.pricePerNight} currency={room.currency} size="sm" hideCode /> per night
              </p>
            </div>
            <div className="grid gap-1 justify-items-start sm:justify-items-end">
              <Price cents={room.totalPrice} currency={room.currency} size="lg" />
              <span className="text-sm text-muted-foreground">Total stay</span>
            </div>
          </article>
        );
      })}
      <PaginationBar page={page} totalPages={totalPages} total={rooms.length} pageSize={PAGE_SIZE} hrefFor={hrefFor} />
      <Button className="justify-self-end" disabled={selected.length === 0} onClick={book}>
        Book selected rooms
      </Button>
    </div>
  );
}
