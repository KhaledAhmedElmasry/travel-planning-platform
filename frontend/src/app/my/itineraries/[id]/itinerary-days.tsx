"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { CityGroupHeader, type CityGroup } from "@/components/app/itineraries/city-group-header";
import { DayCard, DayForm, type Day } from "@/components/app/itineraries/day-card";
import type { Option } from "@/components/app/itineraries/editor-form";
import type { LinkedBooking } from "@/components/app/itineraries/link-booking-dialog";
import type { Transport } from "@/components/app/itineraries/transport-row";
import { PaginationBar } from "@/components/app/pagination-bar";
import { So3adTip } from "@/components/app/so3ad";
import { ApiError, apiFetch } from "@/lib/api";

export function ItineraryDays({ id, days, groups, cities, currencies, transport, bookings, requestedPage }: {
  id: string; days: Day[]; groups: CityGroup[]; cities: Option[]; currencies: Option[];
  transport: Transport[]; bookings: LinkedBooking[]; requestedPage: number;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const path = `/api/itineraries/${id}/days`;
  const totalPages = Math.max(1, Math.ceil(days.length / 10));
  const page = Math.max(1, Math.min(totalPages, requestedPage));
  const visibleDays = new Map(days.slice((page - 1) * 10, page * 10).map((day) => [day.id, day]));
  const positions = days.map((day) => ({ value: day.id, label: `Day ${day.number}` }));

  async function move(dayId: string, position: number) {
    if (moving || days.find((day) => day.id === dayId)?.number === position) return;
    setMoving(true);
    try {
      await apiFetch(`${path}/reorder`, { method: "PATCH", json: { dayId, position } });
      router.refresh();
      toast.success("Day moved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not move the day.");
    } finally {
      setMoving(false);
    }
  }

  return (
    <section className="grid gap-4" aria-busy={moving}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Days</h2>
        {days.length < 60 && <DayForm path={path} cities={cities} />}
      </div>
      {days.length === 0 && <EmptyState title="No days yet" />}
      {days.length > 1 && <So3adTip>Drag days to reorder them.</So3adTip>}
      {groups.map((group) => {
        const groupDays = group.dayIds.flatMap((id) => {
          const day = visibleDays.get(id);
          return day ? [day] : [];
        });
        if (!groupDays.length) return null;
        return (
          <section key={group.dayIds[0]} className="grid gap-3">
            <CityGroupHeader name={cities.find((city) => city.value === group.cityId)?.label ?? group.cityId} group={group} />
            {groupDays.map((day) => (
              <DayCard key={day.id} day={day} itineraryId={id} cities={cities} currencies={currencies}
                days={positions} transport={transport} bookings={bookings} moving={moving} onMove={move} />
            ))}
          </section>
        );
      })}
      <PaginationBar page={page} totalPages={totalPages} total={days.length} hrefFor={(page) => `?dayPage=${page}`} />
    </section>
  );
}
