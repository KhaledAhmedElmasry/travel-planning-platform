"use client";

// HotelSearchForm
// Part: Lead (foundation)
// Requirements: HTL-11, HTL-12
// Used by: P-15, home, P-26 Find hotels
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <HotelSearchForm countries={countries} cities={cities} initial={fromUrl} onSearch={(params) => ...} />
// Team leader (23 Nov): one Destination list grouped into Countries and Cities (GET /api/countries,
// GET /api/cities); the form hands exactly the GET /api/hotels/search params to onSearch (the
// price / rating filters and sort come from FilterPanel and SortSelect). Invalid input is prevented
// (HTL-11): no check-in in the past, check-out only after check-in, guests and rooms at least 1,
// Search disabled until destination and both dates are set.
import { useState, type FormEvent } from "react";
import { DatePicker } from "@/components/app/date-picker";
import { FormField } from "@/components/app/form-field";
import { NumberStepper } from "@/components/app/number-stepper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fromDateString, toDateString, todayString } from "@/lib/dates";

export type Country = { code: string; name: string; currency: string };
export type City = { cityId: string; name: string; countryCode: string };

/** GET /api/hotels/search query (openapi), without filters, sort and page. Either city or country. */
export type HotelSearchParams = {
  city?: string;
  country?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
};

type Props = {
  countries: Country[];
  cities: City[];
  onSearch: (params: HotelSearchParams) => void;
  initial?: Partial<HotelSearchParams>;
  submitLabel?: string;
};

function nextDay(day: string): string {
  const date = fromDateString(day)!;
  date.setDate(date.getDate() + 1);
  return toDateString(date);
}

export function HotelSearchForm({ countries, cities, onSearch, initial = {}, submitLabel = "Search hotels" }: Props) {
  // "city:cairo" or "country:EG"
  const [destination, setDestination] = useState(
    initial.city ? `city:${initial.city}` : initial.country ? `country:${initial.country}` : "",
  );
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState(initial.guests ?? 1);
  const [rooms, setRooms] = useState(initial.rooms ?? 1);

  const ready = Boolean(destination && checkIn && checkOut);

  function changeCheckIn(value: string | undefined) {
    setCheckIn(value);
    if (value && checkOut && checkOut <= value) setCheckOut(undefined); // HTL-11: check-out after check-in
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !checkIn || !checkOut) return;
    const [kind, id] = destination.split(":");
    onSearch({ ...(kind === "city" ? { city: id } : { country: id }), checkIn, checkOut, guests, rooms });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {/* Select outside FormField: FormField labels its direct child, the trigger button. */}
      <Select value={destination} onValueChange={setDestination}>
        <FormField label="Destination" name="destination" required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="City or country" />
          </SelectTrigger>
        </FormField>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Countries</SelectLabel>
            {countries.map((c) => (
              <SelectItem key={c.code} value={`country:${c.code}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Cities</SelectLabel>
            {cities.map((c) => (
              <SelectItem key={c.cityId} value={`city:${c.cityId}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Check-in" name="checkIn" required>
          <DatePicker value={checkIn} onChange={changeCheckIn} min={todayString()} />
        </FormField>
        <FormField label="Check-out" name="checkOut" required>
          <DatePicker value={checkOut} onChange={setCheckOut} min={nextDay(checkIn ?? todayString())} />
        </FormField>
      </div>

      <div className="grid gap-1 sm:grid-cols-2 sm:gap-4">
        <NumberStepper label="Guests" value={guests} min={1} onChange={setGuests} />
        <NumberStepper label="Rooms" value={rooms} min={1} onChange={setRooms} />
      </div>

      <Button type="submit" disabled={!ready} className="justify-self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
