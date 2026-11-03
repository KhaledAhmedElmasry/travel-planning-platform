// Requirement: FLT-15.
import { BadRequestException } from '@nestjs/common';

export enum FlightSortBy {
  Price = 'price',
  Duration = 'duration',
  DepartureTime = 'departure_time',
}

export enum FlightSortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}

export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

export interface SortableFlightResult {
  flightId: string;
  departureUtc: Date;
  durationMinutes: number;
  cabins: { price: number }[];
}

export function validatePriceRange({ minPrice, maxPrice }: PriceRange): void {
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new BadRequestException(
      'minPrice must not be greater than maxPrice.',
    );
  }
}

export function isWithinPriceRange(
  cabinFare: number,
  { minPrice, maxPrice }: PriceRange,
): boolean {
  return (
    (minPrice === undefined || cabinFare >= minPrice) &&
    (maxPrice === undefined || cabinFare <= maxPrice)
  );
}

function lowestMatchingCabinPrice(flight: SortableFlightResult): number {
  return Math.min(...flight.cabins.map(({ price }) => price));
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
