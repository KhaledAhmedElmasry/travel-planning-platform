import { inflateSync } from 'zlib';
import { CabinClass, PassengerType } from '../common/enums';
import { localTime, renderETicket } from './e-ticket';
import { daysBeforeDeparture } from './flight-booking-lifecycle.service';
import { newReference } from '../payments/booking-reference';

// FLT-23 unit tests for the small helpers (local only). The seat hold, confirmation, expiry and
// cancellation are tested end to end by the local harness against MongoDB and Stripe.

describe('newReference (FLT-23)', () => {
  it('is 6 characters without look-alikes (0, O, 1, I, L)', () => {
    for (let i = 0; i < 200; i++) {
      expect(newReference()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('is random', () => {
    const refs = new Set(Array.from({ length: 200 }, () => newReference()));
    expect(refs.size).toBeGreaterThan(195);
  });
});

describe('daysBeforeDeparture (FLT-09, FLT-26)', () => {
  const departure = new Date('2026-12-10T12:00:00Z');

  it('counts whole days only', () => {
    expect(
      daysBeforeDeparture(departure, new Date('2026-12-03T12:00:00Z')),
    ).toBe(7);
    expect(
      daysBeforeDeparture(departure, new Date('2026-12-03T12:00:01Z')),
    ).toBe(6);
    expect(
      daysBeforeDeparture(departure, new Date('2026-12-03T07:00:00Z')),
    ).toBe(7);
  });

  it('is 0 on the last day before departure', () => {
    expect(
      daysBeforeDeparture(departure, new Date('2026-12-10T11:59:00Z')),
    ).toBe(0);
  });
});

describe('localTime (GEN-06)', () => {
  const utc = new Date('2026-12-01T18:35:00Z');

  it("shows the time in the airport's time zone", () => {
    expect(localTime(utc, 'Africa/Cairo')).toBe(
      '2026-12-01 20:35 (Africa/Cairo)',
    );
    expect(localTime(utc, 'Asia/Dubai')).toBe('2026-12-01 22:35 (Asia/Dubai)');
  });

  it('falls back to UTC for an unknown time zone', () => {
    expect(localTime(utc, 'Mars/Base')).toBe('2026-12-01 18:35 (UTC)');
  });
});

// The text drawn on the pages of a PDF made by pdfkit: each page content stream is
// Flate-compressed, and the text is written as hex strings inside TJ arrays (one array per line).
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const lines: string[] = [];
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (let m = streams.exec(raw); m; m = streams.exec(raw)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const tj of content.match(/\[([^\]]*)\]\s*TJ/g) ?? []) {
      lines.push(
        (tj.match(/<([0-9a-fA-F]*)>/g) ?? [])
          .map((hex) => Buffer.from(hex.slice(1, -1), 'hex').toString('latin1'))
          .join(''),
      );
    }
  }
  return lines.join('\n');
}

describe('renderETicket (FLT-23)', () => {
  it('returns a PDF with the reference, flight, local times, baggage, passengers and total', async () => {
    const pdf = await renderETicket({
      reference: 'K7QM2X',
      totalAmount: 25000,
      currency: 'USD',
      segments: [
        {
          flightNumber: 'NA100',
          airlineName: 'Nile Air',
          cabinClass: CabinClass.Economy,
          departureAirport: { code: 'CAI', timeZone: 'Africa/Cairo' },
          arrivalAirport: { code: 'DXB', timeZone: 'Asia/Dubai' },
          departureAt: new Date('2026-12-01T18:35:00Z'),
          arrivalAt: new Date('2026-12-01T22:35:00Z'),
          freeBags: 1,
          maxBagWeightKg: 23,
        },
      ] as never,
      passengers: [
        {
          type: PassengerType.Adult,
          fullName: 'Mona Adel',
          dateOfBirth: '1998-04-15',
          passportNumber: 'A12345678',
          extraBags: [{ weightKg: 20 }],
          fare: 25000,
          baggageFee: 0,
        },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(pdf);
    // FLT-23: booking reference and confirmed status.
    expect(text).toContain('Booking reference: K7QM2X');
    expect(text).toContain('Status: Confirmed');
    // Flight, airline and cabin; times in each airport's local time zone (GEN-06).
    expect(text).toContain('NA100 - Nile Air');
    expect(text).toContain('CAI  2026-12-01 20:35 (Africa/Cairo)');
    expect(text).toContain('DXB  2026-12-02 02:35 (Asia/Dubai)');
    expect(text).toContain('1 free bag(s) per passenger, up to 23 kg each');
    // Every passenger with type, passport/ID and extra baggage.
    expect(text).toContain('Mona Adel (adult) - passport/ID A12345678');
    expect(text).toContain('extra bags: 20 kg');
    expect(text).toContain('Total paid:');
    expect(text).toContain('250.00');
  });
});
