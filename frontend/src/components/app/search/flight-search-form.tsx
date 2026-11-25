"use client";

// FlightSearchForm
// Part: Lead (foundation)
// Requirements: FLT-11, FLT-12, FLT-15
// Used by: P-12, home, P-26 Find flights, P-21 change flight
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <FlightSearchForm airports={airports} initial={fromUrl} onSearch={(params) => router.push(`/flights?${new URLSearchParams(...)}`)} />
// Team leader (23 Nov): the form hands the exact GET /api/flights/search params to onSearch and
// each page decides what to do with them. Invalid input is prevented instead of reported: the
// arrival list hides the departure airport, infants <= adults, adults >= 1, no past departure,
// no return before departure, Search disabled until airports and dates are set.
// Airports come from GET /api/airports (FLT-02), so only listed airports can be chosen.
import { useState, type FormEvent } from "react";
import { DatePicker } from "@/components/app/date-picker";
import { FormField } from "@/components/app/form-field";
import { NumberStepper } from "@/components/app/number-stepper";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayString } from "@/lib/dates";
import { So3adTip } from "@/components/app/so3ad";

export type Airport = { iataCode: string; name: string; cityId: string; countryCode: string; timeZone: string };
export type TripType = "one_way" | "round_trip";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";

/** Exactly the query of GET /api/flights/search (openapi), without filters, sort and page. */
export type FlightSearchParams = {
  tripType: TripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass?: CabinClass;
};

// Spec P-12 labels.
export const CABIN_LABEL: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
};
const ANY_CABIN = "any";

type Props = {
  airports: Airport[];
  onSearch: (params: FlightSearchParams) => void;
  initial?: Partial<FlightSearchParams>;
  submitLabel?: string;
};

export function FlightSearchForm({ airports, onSearch, initial = {}, submitLabel = "Search flights" }: Props) {
  const [tripType, setTripType] = useState<TripType>(initial.tripType ?? "one_way");
  const [origin, setOrigin] = useState(initial.origin ?? "");
  const [destination, setDestination] = useState(initial.destination ?? "");
  const [departureDate, setDepartureDate] = useState(initial.departureDate);
  const [returnDate, setReturnDate] = useState(initial.returnDate);
  const [adults, setAdults] = useState(initial.adults ?? 1);
  const [children, setChildren] = useState(initial.children ?? 0);
  const [infants, setInfants] = useState(initial.infants ?? 0);
  const [cabin, setCabin] = useState<string>(initial.cabinClass ?? ANY_CABIN);

  const roundTrip = tripType === "round_trip";
  const ready = Boolean(origin && destination && departureDate && (!roundTrip || returnDate));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !departureDate) return;
    onSearch({
      tripType,
      origin,
      destination,
      departureDate,
      ...(roundTrip && returnDate ? { returnDate } : {}),
      adults,
      children,
      infants,
      ...(cabin !== ANY_CABIN ? { cabinClass: cabin as CabinClass } : {}),
    });
  }

  function changeAdults(value: number) {
    setAdults(value);
    if (infants > value) setInfants(value); // FLT-12: no more infants than adults
  }

  function changeDeparture(value: string | undefined) {
    setDepartureDate(value);
    if (value && returnDate && returnDate < value) setReturnDate(undefined);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <RadioGroup
        value={tripType}
        onValueChange={(value) => setTripType(value as TripType)}
        className="flex gap-6"
        aria-label="Trip type"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="one_way" id="trip-one-way" />
          <Label htmlFor="trip-one-way">One way</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="round_trip" id="trip-round" />
          <Label htmlFor="trip-round">Round trip</Label>
        </div>
      </RadioGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Select outside FormField: FormField labels its direct child, the trigger button. */}
        <Select
          value={origin}
          onValueChange={(value) => {
            setOrigin(value);
            if (value === destination) setDestination("");
          }}
        >
          <FormField label="From" name="origin" required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Departure airport" />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {airports.map((a) => (
              <SelectItem key={a.iataCode} value={a.iataCode}>
                {a.iataCode} · {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={destination} onValueChange={setDestination}>
          <FormField label="To" name="destination" required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Arrival airport" />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {airports
              .filter((a) => a.iataCode !== origin)
              .map((a) => (
                <SelectItem key={a.iataCode} value={a.iataCode}>
                  {a.iataCode} · {a.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Departure date" name="departureDate" required hint="Local date at the departure airport">
          <DatePicker value={departureDate} onChange={changeDeparture} min={todayString()} />
        </FormField>
        {roundTrip && (
          <FormField label="Return date" name="returnDate" required>
            <DatePicker value={returnDate} onChange={setReturnDate} min={departureDate ?? todayString()} />
          </FormField>
        )}
      </div>

      <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
        <NumberStepper label="Adults" hint="12 years and older" value={adults} min={1} onChange={changeAdults} />
        <NumberStepper label="Children" hint="2 to 11 years" value={children} min={0} onChange={setChildren} />
        <NumberStepper label="Infants" hint="Under 2 years" value={infants} min={0} max={adults} onChange={setInfants} />
      </div>
      <So3adTip>Infants pay 10% of the fare and don&rsquo;t take a seat.</So3adTip>

      <Select value={cabin} onValueChange={setCabin}>
        <FormField label="Cabin class" name="cabinClass">
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
        </FormField>
        <SelectContent>
          <SelectItem value={ANY_CABIN}>Any cabin</SelectItem>
          {(Object.keys(CABIN_LABEL) as CabinClass[]).map((c) => (
            <SelectItem key={c} value={c}>
              {CABIN_LABEL[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" disabled={!ready} className="justify-self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
