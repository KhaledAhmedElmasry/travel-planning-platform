// Requirement: FLT-15.
import {
  compareFlightSearchResults,
  FlightSortBy,
  FlightSortOrder,
  isWithinPriceRange,
  validatePriceRange,
  type PriceRange,
  type SortableFlightResult,
} from './flight-sorting';

function flight(
  flightId: string,
  departureHour: number,
  durationMinutes: number,
  cabinPrices: number[],
): SortableFlightResult {
  return {
    flightId,
    departureUtc: new Date(
      `2026-11-02T${String(departureHour).padStart(2, '0')}:00:00.000Z`,
    ),
    durationMinutes,
    cabins: cabinPrices.map((price) => ({ price })),
  };
}

function sortedIds(
  flights: SortableFlightResult[],
  sortBy: FlightSortBy,
  sortOrder: FlightSortOrder,
): string[] {
  return flights
    .slice()
    .sort((first, second) =>
      compareFlightSearchResults(first, second, sortBy, sortOrder),
    )
    .map(({ flightId }) => flightId);
}

describe('flight price filtering (FLT-15)', () => {
  it('includes prices exactly at inclusive bounds', () => {
    const range: PriceRange = { minPrice: 10, maxPrice: 10 };
    expect(isWithinPriceRange(10, range)).toBe(true);
    expect(isWithinPriceRange(9.99, range)).toBe(false);
    expect(isWithinPriceRange(10.01, range)).toBe(false);
  });

  it('supports either missing price bound', () => {
    expect(isWithinPriceRange(5, { maxPrice: 5 })).toBe(true);
    expect(isWithinPriceRange(5, { minPrice: 5 })).toBe(true);
    expect(isWithinPriceRange(4.99, { minPrice: 5 })).toBe(false);
    expect(isWithinPriceRange(5.01, { maxPrice: 5 })).toBe(false);
  });

  it('rejects a minimum price greater than the maximum', () => {
    expect(() => validatePriceRange({ minPrice: 10.01, maxPrice: 10 })).toThrow(
      'minPrice must not be greater than maxPrice.',
    );
  });
});

describe('flight search sorting (FLT-15)', () => {
  const flights = [
    flight('flight-a', 10, 100, [80]),
    flight('flight-b', 11, 80, [100]),
    flight('flight-c', 12, 120, [50]),
  ];

  it.each([
    [
      FlightSortBy.Price,
      FlightSortOrder.Ascending,
      ['flight-c', 'flight-a', 'flight-b'],
    ],
    [
      FlightSortBy.Price,
      FlightSortOrder.Descending,
      ['flight-b', 'flight-a', 'flight-c'],
    ],
    [
      FlightSortBy.Duration,
      FlightSortOrder.Ascending,
      ['flight-b', 'flight-a', 'flight-c'],
    ],
    [
      FlightSortBy.Duration,
      FlightSortOrder.Descending,
      ['flight-c', 'flight-a', 'flight-b'],
    ],
    [
      FlightSortBy.DepartureTime,
      FlightSortOrder.Ascending,
      ['flight-a', 'flight-b', 'flight-c'],
    ],
    [
      FlightSortBy.DepartureTime,
      FlightSortOrder.Descending,
      ['flight-c', 'flight-b', 'flight-a'],
    ],
  ])('sorts by %s %s', (sortBy, sortOrder, expected) => {
    expect(sortedIds(flights, sortBy, sortOrder)).toEqual(expected);
  });

  it('uses the lowest matching cabin price and deterministic ascending tie-breakers', () => {
    const samePrimary = [
      flight('flight-z', 10, 90, [30, 20]),
      flight('flight-b', 10, 90, [20]),
      flight('flight-a', 9, 90, [20]),
    ];
    expect(
      sortedIds(samePrimary, FlightSortBy.Price, FlightSortOrder.Ascending),
    ).toEqual(['flight-a', 'flight-b', 'flight-z']);
  });
});
