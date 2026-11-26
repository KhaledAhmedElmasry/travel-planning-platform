// P-12 (FLT-11, FLT-12, FLT-15): the search criteria live in the URL (Dynamic SSR: shareable links,
// back button), and the same query string goes to GET /api/flights/search (openapi parameters).
import type { SearchFilters } from "@/components/app/search/filter-panel";
import type { CabinClass, FlightSearchParams, TripType } from "@/components/app/search/flight-search-form";
import type { SortValue } from "@/components/app/search/sort-select";

type Params = Record<string, string | string[] | undefined>;

export type FlightSearch = {
  /** Undefined until origin, destination and departure date are all set: then nothing is searched. */
  criteria?: FlightSearchParams;
  /** What the form starts with (also the incomplete criteria of a half-filled URL). */
  initial: Partial<FlightSearchParams>;
  filters: SearchFilters;
  sort?: SortValue;
  page: number;
};

const TRIP_TYPES: TripType[] = ["one_way", "round_trip"];
const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];
const SORT_BY = ["price", "duration", "departure_time"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: Params[string]) => (typeof value === "string" ? value.trim() : "");

/** A whole number >= min, else undefined. */
function whole(value: Params[string], min: number): number | undefined {
  const n = Number(text(value));
  return text(value) !== "" && Number.isInteger(n) && n >= min ? n : undefined;
}

const date = (value: Params[string]) => (DATE.test(text(value)) ? text(value) : undefined);
const iata = (value: Params[string]) => text(value).toUpperCase() || undefined;

export function parseFlightSearch(params: Params): FlightSearch {
  const tripType = TRIP_TYPES.find((t) => t === text(params.tripType)) ?? "one_way";
  const cabinClass = CABINS.find((c) => c === text(params.cabinClass));
  const initial: Partial<FlightSearchParams> = {
    tripType,
    origin: iata(params.origin),
    destination: iata(params.destination),
    departureDate: date(params.departureDate),
    returnDate: tripType === "round_trip" ? date(params.returnDate) : undefined,
    adults: whole(params.adults, 1) ?? 1,
    children: whole(params.children, 0) ?? 0,
    infants: whole(params.infants, 0) ?? 0,
    ...(cabinClass ? { cabinClass } : {}),
  };

  const complete =
    initial.origin && initial.destination && initial.departureDate && (tripType === "one_way" || initial.returnDate);
  const criteria = complete ? (initial as FlightSearchParams) : undefined;

  const filters: SearchFilters = {};
  const minPrice = whole(params.minPrice, 0);
  const maxPrice = whole(params.maxPrice, 0);
  if (minPrice !== undefined) filters.minPrice = minPrice;
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;

  const sortBy = SORT_BY.find((s) => s === text(params.sortBy));
  const sort: SortValue | undefined = sortBy
    ? { sortBy, sortOrder: text(params.sortOrder) === "desc" ? "desc" : "asc" }
    : undefined;

  return { criteria, initial, filters, sort, page: whole(params.page, 1) ?? 1 };
}

/** The URL query of a search: the criteria, the price filter, the sort and the page (left out on page 1). */
export function searchQuery(
  criteria: Partial<FlightSearchParams>,
  filters: SearchFilters,
  sort: SortValue | undefined,
  page: number,
): string {
  const query = new URLSearchParams();
  const values: Record<string, string | number | undefined> = {
    tripType: criteria.tripType,
    origin: criteria.origin,
    destination: criteria.destination,
    departureDate: criteria.departureDate,
    returnDate: criteria.tripType === "round_trip" ? criteria.returnDate : undefined,
    adults: criteria.adults,
    children: criteria.children,
    infants: criteria.infants,
    cabinClass: criteria.cabinClass,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sortBy: sort?.sortBy,
    sortOrder: sort?.sortOrder,
    page: page > 1 ? page : undefined,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}
