import { BookingStatus as S } from '../common/enums';
import {
  allowedFrom,
  BOOKING_TRANSITIONS,
  canTransition,
} from './booking-lifecycle';

// GEN-11 unit tests (local only). The jobs and actions that use the rule are tested end to end by
// the flight and hotel harnesses.

describe('booking lifecycle (GEN-11)', () => {
  const all = Object.values(S);
  const allowed = [
    [S.PendingPayment, S.Confirmed],
    [S.PendingPayment, S.Expired],
    [S.Confirmed, S.Completed],
    [S.Confirmed, S.Cancelled],
  ];

  it('allows exactly the four transitions of GEN-11', () => {
    for (const from of all) {
      for (const to of all) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it('has an entry for every status, and completed / expired / cancelled are final', () => {
    expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual([...all].sort());
    expect(BOOKING_TRANSITIONS[S.Completed]).toEqual([]);
    expect(BOOKING_TRANSITIONS[S.Expired]).toEqual([]);
    expect(BOOKING_TRANSITIONS[S.Cancelled]).toEqual([]);
  });

  it('gives the status a booking must have before each change', () => {
    expect(allowedFrom(S.Confirmed)).toEqual([S.PendingPayment]);
    expect(allowedFrom(S.Expired)).toEqual([S.PendingPayment]);
    expect(allowedFrom(S.Completed)).toEqual([S.Confirmed]);
    expect(allowedFrom(S.Cancelled)).toEqual([S.Confirmed]);
    expect(allowedFrom(S.PendingPayment)).toEqual([]);
  });
});
