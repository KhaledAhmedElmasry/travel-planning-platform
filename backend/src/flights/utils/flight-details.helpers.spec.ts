// Requirement: FLT-17.
import {
  calculateSeatsRemaining,
  getBookableState,
  NO_CANCELLATION_REFUND_NOTE,
  orderCabinsByCategory,
  sortAndDescribeCancellationTiers,
} from './flight-details.helpers';
import { calculateDurationMinutes } from './flight-time';

describe('flight details helpers', () => {
  it('sorts cancellation tiers descending and describes each tier', () => {
    expect(
      sortAndDescribeCancellationTiers([
        { daysBefore: 0, refundPercentage: 0 },
        { daysBefore: 7, refundPercentage: 80 },
        { daysBefore: 2, refundPercentage: 50 },
      ]),
    ).toEqual([
      {
        daysBeforeDeparture: 7,
        refundPercentage: 80,
        description: 'Cancel 7 or more days before departure: 80% refund',
      },
      {
        daysBeforeDeparture: 2,
        refundPercentage: 50,
        description: 'Cancel 2 or more days before departure: 50% refund',
      },
      {
        daysBeforeDeparture: 0,
        refundPercentage: 0,
        description: 'Cancel 0 or more days before departure: 0% refund',
      },
    ]);
    expect(sortAndDescribeCancellationTiers(undefined)).toEqual([]);
    expect(NO_CANCELLATION_REFUND_NOTE).toBe(
      'No refund is available after booking.',
    );
  });

  it('marks flights unbookable for status, inactive airline, or departed time', () => {
    const now = new Date('2026-11-01T00:00:00.000Z');
    const futureDeparture = new Date('2026-11-02T00:00:00.000Z');
    expect(getBookableState('scheduled', true, futureDeparture, now)).toEqual({
      bookable: true,
      bookableReason: null,
    });
    expect(
      getBookableState('cancelled', true, futureDeparture, now).bookable,
    ).toBe(false);
    expect(
      getBookableState('scheduled', false, futureDeparture, now).bookableReason,
    ).toBe('Airline is inactive.');
    expect(
      getBookableState(
        'scheduled',
        true,
        new Date('2026-10-31T23:59:59.000Z'),
        now,
      ).bookableReason,
    ).toBe('Flight has already departed.');
  });

  it('never reports negative remaining seats and orders every cabin category', () => {
    expect(calculateSeatsRemaining(3, 2, 1)).toBe(0);
    expect(calculateSeatsRemaining(2, 4, 3)).toBe(0);
    expect(
      orderCabinsByCategory([
        { cabinClass: 'first' },
        { cabinClass: 'business' },
        { cabinClass: 'premium_economy' },
        { cabinClass: 'economy' },
      ]),
    ).toEqual([
      { cabinClass: 'economy' },
      { cabinClass: 'premium_economy' },
      { cabinClass: 'business' },
      { cabinClass: 'first' },
    ]);
  });

  it('calculates duration in the same whole minutes used by flight search', () => {
    expect(
      calculateDurationMinutes(
        new Date('2026-11-02T10:00:00.000Z'),
        new Date('2026-11-02T13:15:00.000Z'),
      ),
    ).toBe(195);
  });
});
