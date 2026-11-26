"use client";

// FindHotelsPanel
// Part: T3 Itinerary editor
// Requirements: ITN-25
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { NumberStepper } from "@/components/app/number-stepper";
import { PaginationBar } from "@/components/app/pagination-bar";
import { HotelResultCard, type HotelSearchResult } from "@/components/app/search/hotel-result-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { formatDay, fromDateString, toDateString } from "@/lib/dates";
import type { CityGroup } from "./city-group-header";
import { EditorSelect, type Option } from "./editor-form";

type Search = { dayId: string; guests: number; rooms: number };
type Results = {
  items: HotelSearchResult[]; checkIn: string; checkOut: string;
  page: number; totalPages: number; total: number; pageSize: number;
};

function checkOutDate(day: string) {
  const date = fromDateString(day);
  if (!date) return day;
  date.setDate(date.getDate() + 1);
  return toDateString(date);
}

export function FindHotelsPanel({ itineraryId, groups, cities }: {
  itineraryId: string; groups: CityGroup[]; cities: Option[];
}) {
  const [dayId, setDayId] = useState("");
  const [guests, setGuests] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; fields: Record<string, string> }>();
  const [results, setResults] = useState<{ search: Search; data: Results }>();
  const chosen = groups.find((group) => group.dayIds[0] === dayId);
  const selected = chosen ?? groups[0];
  const cityName = (id: string) => cities.find((city) => city.value === id)?.label ?? id;

  async function search(criteria: Search, page: number) {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    setResults(undefined);
    try {
      const params = new URLSearchParams({
        dayId: criteria.dayId, guests: String(criteria.guests), rooms: String(criteria.rooms), page: String(page),
      });
      const data = await apiFetch<Results>(`/api/itineraries/${itineraryId}/hotels?${params}`);
      setResults({ search: criteria, data });
    } catch (error) {
      setFailure({
        message: error instanceof ApiError ? error.message : "Could not search for hotels.",
        fields: error instanceof ApiError ? fieldErrorMap(error.body) : {},
      });
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) void search({ dayId: selected.dayIds[0], guests, rooms }, 1);
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">Find hotels</h2>
      {!selected ? <EmptyState title="Add a day to find hotels" compact /> : (
        <form onSubmit={submit} className="grid max-w-xl gap-3">
          <EditorSelect name="dayId" label="City group" value={selected.dayIds[0]} onChange={setDayId}
            error={failure?.fields.dayId} required options={groups.map((group) => ({
              value: group.dayIds[0],
              label: `${cityName(group.cityId)} · ${formatDay(group.startDate)} to ${formatDay(group.endDate)}`,
            }))} />
          <p className="text-sm text-muted-foreground">
            Check-in {formatDay(selected.startDate)} · Check-out {formatDay(checkOutDate(selected.endDate))}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <NumberStepper label="Guests" value={guests} min={1} onChange={setGuests} />
            <NumberStepper label="Rooms" value={rooms} min={1} onChange={setRooms} />
          </div>
          {failure && Object.keys(failure.fields).length > 0 && <FormErrorSummary errors={failure.fields} />}
          <Button type="submit" loading={busy} className="justify-self-start">Search hotels</Button>
        </form>
      )}
      {busy && <Skeleton className="h-32 w-full" aria-label="Searching for hotels" />}
      {failure && <ErrorState message={failure.message} compact />}
      {results && (
        <div className="grid gap-3">
          {results.data.items.length === 0 && <EmptyState title="No available hotels for these dates" compact />}
          {results.data.items.map((hotel) => (
            <HotelResultCard key={hotel.id} hotel={hotel} cityName={cityName(hotel.cityId)}
              countryName={new Intl.DisplayNames(["en"], { type: "region" }).of(hotel.countryCode) ?? hotel.countryCode}
              search={{ checkIn: results.data.checkIn, checkOut: results.data.checkOut, guests: results.search.guests, rooms: results.search.rooms }} />
          ))}
          <div onClick={(event) => {
            const target = event.target instanceof Element ? event.target.closest("a") : null;
            const page = Number(target?.hash.slice("#hotel-page-".length));
            if (!Number.isInteger(page) || page < 1) return;
            event.preventDefault();
            void search(results.search, page);
          }}>
            <PaginationBar page={results.data.page} totalPages={results.data.totalPages} total={results.data.total}
              pageSize={results.data.pageSize} hrefFor={(page) => `#hotel-page-${page}`} />
          </div>
        </div>
      )}
    </section>
  );
}
