import {
  dateOnly,
  daysBeforeCheckIn,
  daysBetween,
  formatDate,
  stayNights,
  todayUtc,
} from './stay-dates';

// HTL-16, HTL-18, HTL-21 unit tests for the date helpers (local only). Booking, hold,
// confirmation, expiry and cancellation are tested end to end by the local harness.

describe('stay dates', () => {
  it('reads and writes YYYY-MM-DD as 00:00 UTC', () => {
    expect(dateOnly('2026-12-01').toISOString()).toBe(
      '2026-12-01T00:00:00.000Z',
    );
    expect(formatDate(dateOnly('2026-12-01'))).toBe('2026-12-01');
  });

  it('gives one night per date from check-in to the day before check-out', () => {
    const nights = stayNights(dateOnly('2026-12-30'), dateOnly('2027-01-02'));
    expect(nights.map(formatDate)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
    expect(stayNights(dateOnly('2026-12-01'), dateOnly('2026-12-01'))).toEqual(
      [],
    );
  });

  it("uses today's UTC date whatever the time", () => {
    expect(formatDate(todayUtc(new Date('2026-12-01T23:59:59Z')))).toBe(
      '2026-12-01',
    );
    expect(formatDate(todayUtc(new Date('2026-12-02T00:00:00Z')))).toBe(
      '2026-12-02',
    );
  });

  it('counts whole calendar days, also across a month and a leap day', () => {
    expect(daysBetween(dateOnly('2028-02-27'), dateOnly('2028-03-01'))).toBe(3);
  });

  it('counts days before check-in from today (0 on the check-in date)', () => {
    const checkIn = dateOnly('2026-12-10');
    expect(daysBeforeCheckIn(checkIn, new Date('2026-12-07T22:00:00Z'))).toBe(
      3,
    );
    expect(daysBeforeCheckIn(checkIn, new Date('2026-12-09T23:59:00Z'))).toBe(
      1,
    );
    expect(daysBeforeCheckIn(checkIn, new Date('2026-12-10T08:00:00Z'))).toBe(
      0,
    );
  });
});
