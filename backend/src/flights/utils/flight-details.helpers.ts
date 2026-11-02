// Requirement: FLT-17.
import { CabinCategory, CABIN_CATEGORIES } from '../placeholders/flight.schema';

export const SCHEDULED_FLIGHT_STATUS = 'scheduled';
export const NO_CANCELLATION_REFUND_NOTE =
  'No refund is available after booking.';

export interface CancellationTier {
  daysBeforeDeparture: number;
  refundPercentage: number;
}

export interface DescribedCancellationTier extends CancellationTier {
  description: string;
}

export interface BookableState {
  bookable: boolean;
  bookableReason: string | null;
}

export function sortAndDescribeCancellationTiers(
  tiers: CancellationTier[] | null | undefined,
): DescribedCancellationTier[] {
  return [...(tiers ?? [])]
    .sort(
      (first, second) => second.daysBeforeDeparture - first.daysBeforeDeparture,
    )
    .map((tier) => ({
      ...tier,
      description: describeCancellationTier(tier),
    }));
}

export function describeCancellationTier(tier: CancellationTier): string {
  return `Cancel ${tier.daysBeforeDeparture} or more days before departure: ${tier.refundPercentage}% refund`;
}

export function getBookableState(
  status: string,
  airlineIsActive: boolean,
  departureUtc: Date,
  now: Date = new Date(),
): BookableState {
  if (status.toLowerCase() !== SCHEDULED_FLIGHT_STATUS) {
    return {
      bookable: false,
      bookableReason: `Flight is not scheduled (status: ${status}).`,
    };
  }
  if (!airlineIsActive) {
    return { bookable: false, bookableReason: 'Airline is inactive.' };
  }
  if (departureUtc.getTime() <= now.getTime()) {
    return { bookable: false, bookableReason: 'Flight has already departed.' };
  }
  return { bookable: true, bookableReason: null };
}

export function calculateSeatsRemaining(
  seatCount: number,
  booked: number,
  held: number,
): number {
  return Math.max(0, seatCount - booked - held);
}

export function orderCabinsByCategory<T extends { category: CabinCategory }>(
  cabins: T[],
): T[] {
  // The API presents cabins in the same fixed order regardless of database array order.
  return [...cabins].sort(
    (first, second) =>
      CABIN_CATEGORIES.indexOf(first.category) -
      CABIN_CATEGORIES.indexOf(second.category),
  );
}
