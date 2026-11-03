// Requirement: FLT-17.
import { CabinClass } from '../../common/enums';

export const SCHEDULED_FLIGHT_STATUS = 'scheduled';
export const NO_CANCELLATION_REFUND_NOTE =
  'No refund is available after booking.';

export interface CancellationTier {
  daysBefore: number;
  refundPercentage: number;
}

export interface DescribedCancellationTier {
  daysBeforeDeparture: number;
  refundPercentage: number;
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
    .sort((first, second) => second.daysBefore - first.daysBefore)
    .map((tier) => ({
      daysBeforeDeparture: tier.daysBefore,
      refundPercentage: tier.refundPercentage,
      description: describeCancellationTier(tier),
    }));
}

export function describeCancellationTier(tier: CancellationTier): string {
  return `Cancel ${tier.daysBefore} or more days before departure: ${tier.refundPercentage}% refund`;
}

export function getBookableState(
  status: string,
  airlineIsActive: boolean,
  departureUtc: Date,
  now: Date = new Date(),
): BookableState {
  if (status !== SCHEDULED_FLIGHT_STATUS) {
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

export function orderCabinsByCategory<T extends { cabinClass: CabinClass }>(
  cabins: T[],
): T[] {
  const cabinOrder = Object.values(CabinClass);
  return [...cabins].sort(
    (first, second) =>
      cabinOrder.indexOf(first.cabinClass) -
      cabinOrder.indexOf(second.cabinClass),
  );
}
