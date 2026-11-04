// Area: Flight Search & Booking
// Requirement: FLT-17 (flight details), shared with FLT-11 search results.
import { CabinClass } from '../../common/enums';
import { isOpenFlight } from '../flight-status.job';
import { FlightStatus } from '../schemas/flight.schema';

export const NO_CANCELLATION_REFUND_NOTE =
  'This airline gives no refund when a booking is cancelled.';

export interface CancellationTier {
  daysBefore: number;
  refundPercentage: number;
}

export interface DescribedCancellationTier extends CancellationTier {
  description: string;
}

export interface BookableState {
  bookable: boolean;
  bookableReason: string | null;
}

export function durationMinutes(departureAt: Date, arrivalAt: Date): number {
  return Math.round((arrivalAt.getTime() - departureAt.getTime()) / 60_000);
}

export function seatsRemaining(cabin: {
  total: number;
  booked: number;
  held: number;
}): number {
  return Math.max(0, cabin.total - cabin.booked - cabin.held);
}

// FLT-09: tiers highest daysBefore first, each with a sentence for the page.
export function describeCancellationTiers(
  tiers: readonly CancellationTier[] | null | undefined,
): DescribedCancellationTier[] {
  return [...(tiers ?? [])]
    .sort((a, b) => b.daysBefore - a.daysBefore)
    .map((tier) => ({
      daysBefore: tier.daysBefore,
      refundPercentage: tier.refundPercentage,
      description: `Cancel ${tier.daysBefore} or more days before departure: ${tier.refundPercentage}% refund.`,
    }));
}

// Whether the flight can be booked now: Scheduled and not departed (FLT-30).
export function bookableState(
  flight: { status: FlightStatus; departureAt: Date },
  now = new Date(),
): BookableState {
  if (isOpenFlight(flight, now))
    return { bookable: true, bookableReason: null };
  if (flight.status === FlightStatus.Cancelled) {
    return { bookable: false, bookableReason: 'The flight was cancelled.' };
  }
  return { bookable: false, bookableReason: 'The flight has departed.' };
}

// Cabins in the fixed order economy, premium_economy, business, first.
export function orderCabins<T extends { cabinClass: CabinClass }>(
  cabins: readonly T[],
): T[] {
  const order = Object.values(CabinClass);
  return [...cabins].sort(
    (a, b) => order.indexOf(a.cabinClass) - order.indexOf(b.cabinClass),
  );
}
