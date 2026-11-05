// Shared helper functions used by several modules.
//
// Cancellation-tier refund rule (FLT-09), shared by airlines (AirlinesService.getRefundTier, used
// by Area 1 for flight refunds FLT-26) and hotels (HTL-10, same selection rule).

// One cancellation tier: cancelling at least `daysBefore` days before departure (or check-in)
// refunds `refundPercentage` percent (0-100).
export interface Tier {
  daysBefore: number;
  refundPercentage: number;
}

// The tier that applies to one cancellation. Same shape as RefundTier in
// payments/interfaces/payable-booking.interface.ts.
export interface AppliedTier {
  refundPercentage: number;
  // daysBefore of the tier used, or null if no tier applies (0%).
  tierDaysBefore: number | null;
}

// FLT-09 rule: use the tier with the highest daysBefore that does not exceed the days remaining.
// If no tier applies (or there are no tiers), the refund is 0%.
// Example: tiers 30 -> 100%, 7 -> 50%, 1 -> 10%
//   40 days left -> 100% (tier 30); 10 days -> 50% (tier 7); 0 days -> 0% (no tier).
export function pickRefundTier(
  tiers: readonly Tier[],
  daysRemaining: number,
): AppliedTier {
  let best: Tier | null = null;
  for (const tier of tiers ?? []) {
    if (
      tier.daysBefore <= daysRemaining &&
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

// FLT-09, HTL-10: each daysBefore threshold must be unique within one policy. Returns the first
// threshold used twice, or null if they are all different.
export function findDuplicateThreshold(tiers: readonly Tier[]): number | null {
  const seen = new Set<number>();
  for (const tier of tiers ?? []) {
    if (seen.has(tier.daysBefore)) return tier.daysBefore;
    seen.add(tier.daysBefore);
  }
  return null;
}

// The tiers sorted by daysBefore, highest first (how policies are stored and shown).
export function sortTiers<T extends Tier>(tiers: readonly T[]): T[] {
  return [...(tiers ?? [])].sort((a, b) => b.daysBefore - a.daysBefore);
}
