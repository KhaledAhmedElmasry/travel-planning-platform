"use client";

// FindFlightsPanel
// Part: T3 Itinerary editor
// Requirements: ITN-26
// Used by: P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { bookingHref, type FlightSearchResult } from "@/app/flights/flight-search";
import { DatePicker } from "@/components/app/date-picker";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { NumberStepper } from "@/components/app/number-stepper";
import { PaginationBar } from "@/components/app/pagination-bar";
import { FlightResultCard } from "@/components/app/search/flight-result-card";
import { CABIN_LABEL, type Airport, type CabinClass, type FlightSearchParams, type TripType } from "@/components/app/search/flight-search-form";
import { RoundTripSelector, type FlightChoice } from "@/components/app/search/round-trip-selector";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";
import { todayString } from "@/lib/dates";
import { EditorSelect } from "./editor-form";

type Criteria = Omit<FlightSearchParams, "destination">;
const tripTypes = [{ value: "one_way", label: "One way" }, { value: "round_trip", label: "Round trip" }];
const cabinOptions = [
  { value: "any", label: "Any cabin" },
  ...Object.entries(CABIN_LABEL).map(([value, label]) => ({ value, label })),
];
const labels = { origin: "Origin airport", departureDate: "Departure date", returnDate: "Return date" };

export function FindFlightsPanel({ itineraryId, airports, city, departure, lastDay }: {
  itineraryId: string; airports: Airport[]; city?: { id: string; name: string };
  departure: string; lastDay?: string;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [departureDate, setDepartureDate] = useState<string | undefined>(departure);
  const [returnDate, setReturnDate] = useState(lastDay);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState("any");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [response, setResponse] = useState<{ criteria: Criteria; result: FlightSearchResult; page: number }>();
  const roundTrip = tripType === "round_trip";
  const hasDestination = city && airports.some((airport) => airport.cityId === city.id);
  const today = todayString();

  async function search(criteria: Criteria, page: number, newSearch = false) {
    if (busy) return;
    setBusy(true);
    setFields({});
    setMessage(undefined);
    if (newSearch) setResponse(undefined);

    const query = new URLSearchParams({
      tripType: criteria.tripType, origin: criteria.origin, departureDate: criteria.departureDate,
      adults: String(criteria.adults), children: String(criteria.children), infants: String(criteria.infants), page: String(page),
    });
    if (criteria.returnDate) query.set("returnDate", criteria.returnDate);
    if (criteria.cabinClass) query.set("cabinClass", criteria.cabinClass);
    try {
      const result = await apiFetch<FlightSearchResult>(`/api/itineraries/${itineraryId}/flights?${query}`);
      setResponse({ criteria, result, page });
    } catch (error) {
      setFields(error instanceof ApiError ? fieldErrorMap(error.body) : {});
      setMessage(error instanceof ApiError ? error.message : "Could not search for flights.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!origin) errors.origin = "Choose an origin airport.";
    if (!departureDate || departureDate < today) errors.departureDate = "Choose today or a later date.";
    if (roundTrip && (!returnDate || (departureDate && returnDate < departureDate))) {
      errors.returnDate = "Choose a return date on or after departure.";
    }
    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length || !departureDate) return;

    void search({
      tripType, origin, departureDate, returnDate: roundTrip ? returnDate : undefined,
      adults, children, infants, cabinClass: cabin === "any" ? undefined : cabin as CabinClass,
    }, 1, true);
  }

  function book(criteria: Criteria, outbound: FlightChoice, back?: FlightChoice) {
    router.push(bookingHref({ ...criteria, destination: outbound.flight.arrivalAirport.iataCode }, outbound, back));
  }

  const result = response?.result;
  const totalPages = result && ("outbound" in result
    ? Math.max(result.outbound.totalPages, result.return.totalPages)
    : result.totalPages);

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">Find flights</h2>
      {!city && <EmptyState title="Add a day to find flights" compact />}
      {city && !hasDestination && <EmptyState title={`No airports serve ${city.name}`} compact />}
      {city && hasDestination && (
        <form onSubmit={submit} className="grid max-w-xl gap-4">
          <p>Destination: {city.name}</p>
          <FormErrorSummary errors={fields} labels={labels} />
          <EditorSelect name="tripType" label="Trip type" value={tripType}
            onChange={(value) => setTripType(value === "round_trip" ? "round_trip" : "one_way")} options={tripTypes} />
          <EditorSelect name="origin" label={labels.origin} required value={origin} onChange={setOrigin} error={fields.origin}
            options={airports.filter((airport) => airport.cityId !== city.id)
              .map((airport) => ({ value: airport.iataCode, label: `${airport.iataCode} · ${airport.name}` }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={labels.departureDate} name="departureDate" required error={fields.departureDate}>
              <DatePicker value={departureDate} min={today} onChange={setDepartureDate} />
            </FormField>
            {roundTrip && (
              <FormField label={labels.returnDate} name="returnDate" required error={fields.returnDate}>
                <DatePicker value={returnDate} min={departureDate && departureDate > today ? departureDate : today} onChange={setReturnDate} />
              </FormField>
            )}
          </div>
          <fieldset className="grid gap-1">
            <legend className="text-sm font-medium">Passengers</legend>
            <NumberStepper label="Adults" value={adults} min={1} onChange={(value) => {
              setAdults(value);
              setInfants((current) => Math.min(current, value));
            }} />
            <NumberStepper label="Children" value={children} onChange={setChildren} />
            <NumberStepper label="Infants" value={infants} max={adults} onChange={setInfants} />
          </fieldset>
          <EditorSelect name="cabinClass" label="Cabin" value={cabin} onChange={setCabin} error={fields.cabinClass} options={cabinOptions} />
          <Button type="submit" loading={busy} className="justify-self-start">Search flights</Button>
        </form>
      )}
      {busy && <Skeleton className="h-32 w-full" aria-label="Searching for flights" />}
      {message && <ErrorState message={message} compact />}
      {response && result && (
        <div className="grid gap-4" aria-busy={busy}>
          {"outbound" in result ? (
            <RoundTripSelector outbound={result.outbound.items} returns={result.return.items}
              onContinue={(selection) => book(response.criteria, selection.outbound, selection.return)} />
          ) : result.items.length ? result.items.map((flight) => (
            <FlightResultCard key={flight.id} flight={flight}
              onSelect={(choice, cabinClass) => book(response.criteria, { flight: choice, cabinClass })} />
          )) : <EmptyState title="No flights found" compact />}
          {totalPages !== undefined && (
            <div onClick={(event) => {
              const target = event.target instanceof Element ? event.target.closest("a") : null;
              const page = Number(target?.hash.slice("#flight-page-".length));
              if (!Number.isInteger(page) || page < 1) return;
              event.preventDefault();
              void search(response.criteria, page);
            }}>
              <PaginationBar page={response.page} totalPages={totalPages}
                total={"items" in result ? result.total : undefined}
                hrefFor={(page) => `#flight-page-${page}`} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
