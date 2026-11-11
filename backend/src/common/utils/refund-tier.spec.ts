import { findDuplicateThreshold, pickRefundTier, sortTiers } from './index';

// FLT-09 (Mandatory row 24): "The refund for a cancellation uses the tier with the highest
// threshold not exceeding the days remaining; if no tier applies, the refund is 0%."
// HTL-10 (row 44) applies the same selection rule to hotels.
describe('pickRefundTier (FLT-09, HTL-10)', () => {
  const tiers = [
    { daysBefore: 30, refundPercentage: 100 },
    { daysBefore: 7, refundPercentage: 50 },
    { daysBefore: 2, refundPercentage: 10 },
  ];

  it.each([
    // [days remaining, expected percentage, expected tier]
    [45, 100, 30],
    [30, 100, 30], // exactly the threshold: "not exceeding" includes it
    [29, 50, 7],
    [7, 50, 7],
    [6, 10, 2],
    [2, 10, 2],
    [1, 0, null], // no tier applies -> 0%
    [0, 0, null],
  ])(
    '%i days remaining -> %i%% (tier %p)',
    (daysRemaining, refundPercentage, tierDaysBefore) => {
      expect(pickRefundTier(tiers, daysRemaining)).toEqual({
        refundPercentage,
        tierDaysBefore,
      });
    },
  );

  it('a tier with threshold 0 applies on the last day', () => {
    expect(
      pickRefundTier([{ daysBefore: 0, refundPercentage: 25 }], 0),
    ).toEqual({ refundPercentage: 25, tierDaysBefore: 0 });
  });

  it('does not depend on the order of the tiers', () => {
    expect(pickRefundTier([...tiers].reverse(), 8)).toEqual({
      refundPercentage: 50,
      tierDaysBefore: 7,
    });
  });

  it('gives 0% without any tier', () => {
    expect(pickRefundTier([], 100)).toEqual({
      refundPercentage: 0,
      tierDaysBefore: null,
    });
  });

  it('thresholds must be unique within one policy', () => {
    expect(findDuplicateThreshold(tiers)).toBeNull();
    expect(
      findDuplicateThreshold([
        ...tiers,
        { daysBefore: 7, refundPercentage: 20 },
      ]),
    ).toBe(7);
  });

  it('policies are shown highest threshold first', () => {
    expect(
      sortTiers([tiers[2], tiers[0], tiers[1]]).map((t) => t.daysBefore),
    ).toEqual([30, 7, 2]);
  });
});
