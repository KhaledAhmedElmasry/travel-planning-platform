import { buildRoomCalendar } from './availability-calendar';

const date = (text: string) => new Date(`${text}T00:00:00.000Z`);

describe('buildRoomCalendar', () => {
  const nights = ['2027-03-01', '2027-03-02', '2027-03-03'].map(date);

  it('marks available nights inside an inclusive one-night range', () => {
    expect(
      buildRoomCalendar(
        {
          availableRanges: [
            { from: date('2027-03-02'), to: date('2027-03-02') },
          ],
        },
        [nights[1]],
        [],
      ),
    ).toEqual([{ date: '2027-03-02', status: 'available', reference: null }]);
  });

  it('marks blocked nights outside availability and inside blocked ranges', () => {
    expect(
      buildRoomCalendar(
        {
          availableRanges: [
            { from: date('2027-03-01'), to: date('2027-03-03') },
          ],
          blockedRanges: [{ from: date('2027-03-02'), to: date('2027-03-02') }],
        },
        nights,
        [],
      ),
    ).toEqual([
      { date: '2027-03-01', status: 'available', reference: null },
      { date: '2027-03-02', status: 'blocked', reference: null },
      { date: '2027-03-03', status: 'available', reference: null },
    ]);
  });

  it('gives booked nights precedence and keeps references nullable', () => {
    const room = {
      availableRanges: [{ from: date('2027-03-01'), to: date('2027-03-03') }],
    };
    expect(
      buildRoomCalendar(room, nights, [
        { night: date('2027-03-01'), reference: 'HTL123' },
        { night: date('2027-03-02'), reference: null },
      ]),
    ).toEqual([
      { date: '2027-03-01', status: 'booked', reference: 'HTL123' },
      { date: '2027-03-02', status: 'booked', reference: null },
      { date: '2027-03-03', status: 'available', reference: null },
    ]);
  });

  it('marks a deactivated room blocked', () => {
    expect(
      buildRoomCalendar(
        {
          active: false,
          availableRanges: [
            { from: date('2027-03-01'), to: date('2027-03-03') },
          ],
        },
        nights,
        [],
      ),
    ).toEqual([
      { date: '2027-03-01', status: 'blocked', reference: null },
      { date: '2027-03-02', status: 'blocked', reference: null },
      { date: '2027-03-03', status: 'blocked', reference: null },
    ]);
  });
});
