import type {
  CancellationTier,
  RefundTier,
} from '../payments/interfaces/payable-booking.interface';

// HTL-10, same rule as FLT-09: the tier with the highest daysBefore that is not more than the
// days left before check-in. If no tier applies: 0% and null.
// Example: tiers 14 -> 100%, 3 -> 50%; 5 days left -> { refundPercentage: 50, tierDaysBefore: 3 }.
// TODO: move to common/utils (shared with FLT-09) in a separate PR.
export function pickRefundTier(
  tiers: CancellationTier[],
  daysBeforeCheckIn: number,
): RefundTier {
  let best: CancellationTier | null = null;
  for (const tier of tiers) {
    if (
      tier.daysBefore <= daysBeforeCheckIn &&
      (best === null || tier.daysBefore > best.daysBefore)
    ) {
      best = tier;
    }
  }
  return best
    ? {
        refundPercentage: best.refundPercentage,
        tierDaysBefore: best.daysBefore,
      }
    : { refundPercentage: 0, tierDaysBefore: null };
}
