"use client";

// FindHotelsPanel
// Part: T3 Itinerary editor
// Requirements: ITN-25
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { NumberStepper } from "@/components/app/number-stepper";
import { PaginationBar } from "@/components/app/pagination-bar";
import { HotelResultCard, type HotelSearchResult } from "@/components/app/search/hotel-result-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { formatDay, fromDateString, toDateString } from "@/lib/dates";
import type { CityGroup } from "./city-group-header";

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

export function FindHotelsPanel({ itineraryId, group, cityName }: {
  itineraryId: string; group: CityGroup; cityName: string;
}) {
  const [guests, setGuests] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; fields: Record<string, string> }>();
  const [results, setResults] = useState<{ search: Search; data: Results }>();
  const [lastSearch, setLastSearch] = useState<{ criteria: Search; page: number }>();

  async function search(criteria: Search, page: number) {
    if (busy) return;
    setLastSearch({ criteria, page });
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
    void search({ dayId: group.dayIds[0], guests, rooms }, 1);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label={`Find hotels in ${cityName}, starting ${formatDay(group.startDate)}`}>Find hotels</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find hotels in {cityName}</DialogTitle>
          <DialogDescription>
            Check-in {formatDay(group.startDate)} · Check-out {formatDay(checkOutDate(group.endDate))}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid max-w-xl gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <NumberStepper label="Guests" value={guests} min={1} onChange={setGuests} />
              {failure?.fields.guests && <p className="text-sm text-error">{failure.fields.guests}</p>}
            </div>
            <div>
              <NumberStepper label="Rooms" value={rooms} min={1} onChange={setRooms} />
              {failure?.fields.rooms && <p className="text-sm text-error">{failure.fields.rooms}</p>}
            </div>
          </div>
          <Button type="submit" loading={busy} className="justify-self-start">Search hotels</Button>
        </form>
      {busy && <Skeleton className="h-32 w-full" aria-label="Searching for hotels" />}
      {failure && <ErrorState message={failure.message} compact onRetry={lastSearch
        ? () => void search(lastSearch.criteria, lastSearch.page) : undefined} />}
      {results && (
        <div className="grid gap-3">
          {results.data.items.length === 0 && <EmptyState title="No available hotels for these dates" compact />}
          {results.data.items.map((hotel) => (
            <HotelResultCard key={hotel.id} hotel={hotel} cityName={cityName}
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
      </DialogContent>
    </Dialog>
  );
}
