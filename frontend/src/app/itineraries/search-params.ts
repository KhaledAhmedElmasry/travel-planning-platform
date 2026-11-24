// P-27 (ITN-21): the search criteria live in the URL (Dynamic SSR: shareable links, back button),
// and the same query string goes to GET /api/itineraries/public/search (openapi parameters).
import type { SearchFilters } from "@/components/app/search/filter-panel";

type Params = Record<string, string | string[] | undefined>;

const text = (value: Params[string]) => (typeof value === "string" ? value.trim() : "");

/** A whole number >= 1 (openapi minDays / maxDays / page "minimum: 1"), else undefined. */
function positive(value: Params[string]): number | undefined {
  const n = Number(text(value));
  return text(value) !== "" && Number.isInteger(n) && n >= 1 ? n : undefined;
}

export function parseItinerarySearch(params: Params): { filters: SearchFilters; page: number } {
  const filters: SearchFilters = {};
  const keyword = text(params.keyword);
  const minDays = positive(params.minDays);
  const maxDays = positive(params.maxDays);
  const country = text(params.country);
  const city = text(params.city);
  if (keyword) filters.keyword = keyword;
  if (minDays !== undefined) filters.minDays = minDays;
  if (maxDays !== undefined) filters.maxDays = maxDays;
  if (country) filters.country = country;
  if (city) filters.city = city;
  return { filters, page: positive(params.page) ?? 1 };
}

/** "keyword=nile&minDays=2&page=3" (page left out on page 1). */
export function searchQuery(filters: SearchFilters, page: number): string {
  const query = new URLSearchParams();
  for (const key of ["keyword", "minDays", "maxDays", "country", "city"] as const) {
    if (filters[key] !== undefined) query.set(key, String(filters[key]));
  }
  if (page > 1) query.set("page", String(page));
  return query.toString();
}
