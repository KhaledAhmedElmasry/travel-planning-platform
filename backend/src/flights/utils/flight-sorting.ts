// Area: Flight Search & Booking
// Requirement: FLT-15 (price filter and sorting).
import { BadRequestException } from '@nestjs/common';
import { FlightSortBy, SortOrder } from '../dto/search-flights-query.dto';

export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

export interface SortableFlightResult {
  id: string;
  departureAt: Date;
  durationMinutes: number;
  cabins: { price: number }[];
}

// FLT-15: minPrice greater than maxPrice is a 400.
export function validatePriceRange({ minPrice, maxPrice }: PriceRange): void {
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new BadRequestException(
      'minPrice must not be greater than maxPrice.',
    );
  }
}

// FLT-15: inclusive range of the cabin fare.
export function isWithinPriceRange(
  cabinFare: number,
  { minPrice, maxPrice }: PriceRange,
): boolean {
  return (
    (minPrice === undefined || cabinFare >= minPrice) &&
    (maxPrice === undefined || cabinFare <= maxPrice)
  );
}

// A flight's price for sorting = the lowest fare among its matching cabins.
function lowestCabinPrice(flight: SortableFlightResult): number {
  return Math.min(...flight.cabins.map(({ price }) => price));
}

// FLT-15: sort by price, duration or departure time; ties by departure time, then id, so the
// order (and the pages) never change between two identical requests.
export function compareFlightSearchResults(
  first: SortableFlightResult,
  second: SortableFlightResult,
  sortBy: FlightSortBy,
  sortOrder: SortOrder,
): number {
  const primary =
    sortBy === FlightSortBy.Price
      ? lowestCabinPrice(first) - lowestCabinPrice(second)
      : sortBy === FlightSortBy.Duration
        ? first.durationMinutes - second.durationMinutes
        : first.departureAt.getTime() - second.departureAt.getTime();
  const ordered = sortOrder === SortOrder.Desc ? -primary : primary;
  if (ordered !== 0) return ordered;
  return (
    first.departureAt.getTime() - second.departureAt.getTime() ||
    first.id.localeCompare(second.id)
  );
}
