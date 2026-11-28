"use client";

// Rooms of the hotel (P-43: HTL-03 add, HTL-05 edit, HTL-06 deactivate / delete).
// A table with one row per room; Add and Edit open the RoomForm in a dialog. Deactivate and Delete ask first
// (GEN-03) and show the backend's message when it refuses, e.g. a Confirmed or Pending Payment reservation (409).
// Delete is only offered for rooms that were never reserved (`everReserved`, HTL-06). Dates are handled on P-44.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRangeIcon, PencilIcon, PlusIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { RoomForm, type HotelRoom } from "@/components/app/hotel-dashboard/room-form";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, apiFetch } from "@/lib/api";

type DialogState = { room?: HotelRoom } | null;

export function RoomsManager({ hotelId, rooms }: { hotelId: string; rooms: HotelRoom[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const base = `/api/hotels/${encodeURIComponent(hotelId)}/rooms`;

  /** Runs a change; shows the backend's message when it fails and rethrows so a ConfirmDialog stays open. */
  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "We couldn't save the change. Try again.");
      throw error;
    }
    toast.success(success);
    router.refresh();
  }

  async function activate(room: HotelRoom) {
    setBusyId(room.id);
    try {
      await run(
        () => apiFetch(`${base}/${encodeURIComponent(room.id)}`, { method: "PATCH", json: { active: true } }),
        `Room ${room.roomNumber} is active again`,
      );
    } catch {
      // the toast already shows the error
    } finally {
      setBusyId(null);
    }
  }

  const addButton = (
    <Button onClick={() => setDialog({})}>
      <PlusIcon /> Add room
    </Button>
  );

  return (
    <div className="grid gap-4">
      {rooms.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          line="So empty! Let's add a room."
          description="Add your first room, then give it bookable dates so guests can book it."
          action={addButton}
        />
      ) : (
        <>
          <div className="flex justify-end">{addButton}</div>
          <DataTable
            caption="Rooms of your hotel"
            rows={rooms}
            rowKey={(room) => room.id}
            columns={[
              { header: "Room", cell: (room) => <span className="font-semibold">{room.roomNumber}</span> },
              { header: "Type", cell: (room) => room.type, hideOnMobile: true },
              { header: "Beds", cell: (room) => room.beds, hideOnMobile: true },
              { header: "Max guests", cell: (room) => room.maxOccupancy, hideOnMobile: true },
              { header: "Per night", cell: (room) => <Price cents={room.pricePerNight} currency={room.currency} size="sm" /> },
              {
                header: "Status",
                cell: (room) => <StatusBadge kind="provider" status={room.active ? "active" : "inactive"} />,
              },
              {
                header: "Actions",
                align: "end",
                cell: (room) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ room })}>
                      <PencilIcon /> Edit
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/hotel/rooms/${room.id}`}>
                        <CalendarRangeIcon /> Dates
                      </Link>
                    </Button>
                    {room.active ? (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="secondary">
                            Deactivate
                          </Button>
                        }
                        title={`Deactivate room ${room.roomNumber}?`}
                        description="The room is left out of search and cannot be booked. It is refused when the room has a Confirmed or Pending Payment reservation from today on. You can activate it again later."
                        confirmLabel="Deactivate room"
                        cancelLabel="Keep it active"
                        onConfirm={() =>
                          run(
                            () => apiFetch(`${base}/${encodeURIComponent(room.id)}`, { method: "PATCH", json: { active: false } }),
                            `Room ${room.roomNumber} deactivated`,
                          )
                        }
                      />
                    ) : (
                      <Button size="sm" variant="secondary" loading={busyId === room.id} onClick={() => activate(room)}>
                        Activate
                      </Button>
                    )}
                    {room.everReserved ? (
                      <Button size="sm" variant="ghost" disabled title="This room was reserved before. Deactivate it instead.">
                        Delete
                      </Button>
                    ) : (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="destructive">
                            Delete
                          </Button>
                        }
                        title={`Delete room ${room.roomNumber}?`}
                        description="The room and its dates are removed for good. This can't be undone."
                        confirmLabel="Delete room"
                        cancelLabel="Keep room"
                        onConfirm={() =>
                          run(
                            () => apiFetch(`${base}/${encodeURIComponent(room.id)}`, { method: "DELETE" }),
                            `Room ${room.roomNumber} deleted`,
                          )
                        }
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.room ? `Edit room ${dialog.room.roomNumber}` : "Add a room"}</DialogTitle>
            <DialogDescription>
              {dialog?.room
                ? "Change beds, maximum guests or price. Use Dates to change when the room can be booked."
                : "A new room cannot be booked until you add bookable dates to it."}
            </DialogDescription>
          </DialogHeader>
          {dialog && (
            <RoomForm
              key={dialog.room?.id ?? "new"}
              hotelId={hotelId}
              room={dialog.room}
              currency={rooms[0]?.currency}
              onCancel={() => setDialog(null)}
              onDone={() => {
                setDialog(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
