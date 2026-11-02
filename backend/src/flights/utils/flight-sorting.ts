// Requirement: FLT-15.
import { BadRequestException } from '@nestjs/common';
import { roundCurrencyAmount } from './passenger-pricing';

export enum FlightSortBy {
  Price = 'price',
  Duration = 'duration',
  DepartureTime = 'departureTime',
}

export enum FlightSortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}

export const OPENAPI_DEPARTURE_TIME_SORT = 'departure_time';

export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

export interface SortableFlightResult {
  flightId: string;
  departureUtc: Date;
  durationMinutes: number;
  cabins: { totalPrice: number }[];
}

export function validatePriceRange({ minPrice, maxPrice }: PriceRange): void {
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new BadRequestException(
      'minPrice must not be greater than maxPrice.',
    );
  }
}

export function isWithinPriceRange(
  totalPrice: number,
  { minPrice, maxPrice }: PriceRange,
): boolean {
  // Round the displayed cabin total and bounds before inclusive comparisons to avoid float drift.
  const roundedTotal = roundCurrencyAmount(totalPrice);
  const roundedMinimum =
    minPrice === undefined ? undefined : roundCurrencyAmount(minPrice);
  const roundedMaximum =
    maxPrice === undefined ? undefined : roundCurrencyAmount(maxPrice);
  return (
    (roundedMinimum === undefined || roundedTotal >= roundedMinimum) &&
    (roundedMaximum === undefined || roundedTotal <= roundedMaximum)
  );
}

function lowestMatchingCabinPrice(flight: SortableFlightResult): number {
  // Price sorting follows the cheapest cabin still visible after all search filters.
  return Math.min(
    ...flight.cabins.map(({ totalPrice }) => roundCurrencyAmount(totalPrice)),
  );
}

export function compareFlightSearchResults(
  first: SortableFlightResult,
  second: SortableFlightResult,
  sortBy: FlightSortBy,
  sortOrder: FlightSortOrder,
): number {
  const primaryComparison =
    sortBy === FlightSortBy.Price
      ? lowestMatchingCabinPrice(first) - lowestMatchingCabinPrice(second)
      : sortBy === FlightSortBy.Duration
        ? first.durationMinutes - second.durationMinutes
        : first.departureUtc.getTime() - second.departureUtc.getTime();
  const orderedPrimary =
    sortOrder === FlightSortOrder.Descending
      ? -primaryComparison
      : primaryComparison;
  if (orderedPrimary !== 0) {
    return orderedPrimary;
  }
  return (
    first.departureUtc.getTime() - second.departureUtc.getTime() ||
    (first.flightId < second.flightId
      ? -1
      : first.flightId > second.flightId
        ? 1
        : 0)
  );
}
