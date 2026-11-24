"use client";

// FilterPanel
// Part: Lead (foundation)
// Requirements: FLT-15, HTL-12, ITN-21
// Used by: P-12, P-15, P-27
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <FilterPanel kind="flights" currency="USD" initial={fromUrl} onApply={(filters) => ...} />
// <FilterPanel kind="hotels" currency="USD" ... />          + minimum rating (HTL-12)
// <FilterPanel kind="itineraries" countries={...} cities={...} ... />   keyword, days, country, city (ITN-21)
// Team leader (23 Nov): Apply and Reset buttons; prices typed as whole amounts in the platform
// currency and sent in cents (openapi minPrice / maxPrice); min > max shows an error under Max and
// nothing is applied (FLT-15; same rule for days). onApply gets only the filled filters, so the
// page keeps every other search criterion (FLT-15).
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Country = { code: string; name: string; currency: string };
type City = { cityId: string; name: string; countryCode: string };

export type SearchFilters = {
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  keyword?: string;
  minDays?: number;
  maxDays?: number;
  country?: string;
  city?: string;
};

type Props = {
  kind: "flights" | "hotels" | "itineraries";
  onApply: (filters: SearchFilters) => void;
  initial?: SearchFilters;
  /** Platform currency, shown next to the price fields (flights, hotels). */
  currency?: string;
  countries?: Country[];
  cities?: City[];
};

const ANY = "any";
const toNumber = (text: string) => (text.trim() === "" ? undefined : Number(text));

export function FilterPanel({ kind, onApply, initial = {}, currency = "", countries = [], cities = [] }: Props) {
  const [minPrice, setMinPrice] = useState(initial.minPrice !== undefined ? String(initial.minPrice / 100) : "");
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice !== undefined ? String(initial.maxPrice / 100) : "");
  const [minRating, setMinRating] = useState(initial.minRating !== undefined ? String(initial.minRating) : ANY);
  const [keyword, setKeyword] = useState(initial.keyword ?? "");
  const [minDays, setMinDays] = useState(initial.minDays !== undefined ? String(initial.minDays) : "");
  const [maxDays, setMaxDays] = useState(initial.maxDays !== undefined ? String(initial.maxDays) : "");
  const [country, setCountry] = useState(initial.country ?? ANY);
  const [city, setCity] = useState(initial.city ?? ANY);
  const [errors, setErrors] = useState<{ maxPrice?: string; maxDays?: string }>({});

  const priced = kind === "flights" || kind === "hotels";

  function apply(event: FormEvent) {
    event.preventDefault();
    const filters: SearchFilters = {};
    const next: typeof errors = {};
    if (priced) {
      const min = toNumber(minPrice);
      const max = toNumber(maxPrice);
      if (min !== undefined && max !== undefined && min > max) {
        next.maxPrice = "Max price must be at least the min price";
      }
      if (min !== undefined) filters.minPrice = Math.round(min * 100);
      if (max !== undefined) filters.maxPrice = Math.round(max * 100);
    }
    if (kind === "hotels" && minRating !== ANY) filters.minRating = Number(minRating);
    if (kind === "itineraries") {
      const min = toNumber(minDays);
      const max = toNumber(maxDays);
      if (min !== undefined && max !== undefined && min > max) {
        next.maxDays = "Max days must be at least the min days";
      }
      if (keyword.trim()) filters.keyword = keyword.trim();
      if (min !== undefined) filters.minDays = min;
      if (max !== undefined) filters.maxDays = max;
      if (country !== ANY) filters.country = country;
      if (city !== ANY) filters.city = city;
    }
    setErrors(next);
    if (Object.keys(next).length === 0) onApply(filters);
  }

  function reset() {
    setMinPrice("");
    setMaxPrice("");
    setMinRating(ANY);
    setKeyword("");
    setMinDays("");
    setMaxDays("");
    setCountry(ANY);
    setCity(ANY);
    setErrors({});
    onApply({});
  }

  const unit = currency ? ` (${currency})` : "";

  return (
    <form onSubmit={apply} noValidate className="grid gap-4" aria-label="Filters">
      {kind === "itineraries" && (
        <FormField label="Keyword" name="keyword" hint="Title, country or city">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </FormField>
      )}
      {priced && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label={`Min price${unit}`} name="minPrice">
            <Input type="number" min={0} step={1} inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          </FormField>
          <FormField label={`Max price${unit}`} name="maxPrice" error={errors.maxPrice}>
            <Input type="number" min={0} step={1} inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </FormField>
        </div>
      )}
      {kind === "hotels" && (
        <Select value={minRating} onValueChange={setMinRating}>
          <FormField label="Minimum rating" name="minRating">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            <SelectItem value={ANY}>Any rating</SelectItem>
            {[1, 2, 3, 4, 5].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r} or more
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {kind === "itineraries" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Min days" name="minDays">
              <Input type="number" min={1} step={1} inputMode="numeric" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
            </FormField>
            <FormField label="Max days" name="maxDays" error={errors.maxDays}>
              <Input type="number" min={1} step={1} inputMode="numeric" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
            </FormField>
          </div>
          <Select value={country} onValueChange={setCountry}>
            <FormField label="Country" name="country">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormField>
            <SelectContent>
              <SelectItem value={ANY}>Any country</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={setCity}>
            <FormField label="City" name="city">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormField>
            <SelectContent>
              <SelectItem value={ANY}>Any city</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.cityId} value={c.cityId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <div className="flex gap-2">
        <Button type="submit">Apply</Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
