import { DateTime } from 'luxon';
import PDFDocument from 'pdfkit';
import {
  BookedPassenger,
  BookedSegment,
} from './schemas/flight-booking.schema';

// Area: Payments, Holds & Booking Engine
// FLT-23: the e-ticket PDF of a Confirmed booking: reference, passengers, flights with local
// times (each airport's time zone, GEN-06), cabin and baggage.

export interface ETicketData {
  reference: string;
  segments: BookedSegment[];
  passengers: BookedPassenger[];
  totalAmount: number;
  currency: string;
}

const CABIN_NAMES: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
};

// Builds the PDF in memory and returns its bytes.
export function renderETicket(ticket: ETicketData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(22).text('E-ticket');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12);
    doc.text(`Booking reference: ${ticket.reference}`);
    doc.text('Status: Confirmed');
    doc.moveDown();

    ticket.segments.forEach((segment, i) => {
      const title =
        ticket.segments.length === 2
          ? i === 0
            ? 'Outbound flight'
            : 'Return flight'
          : 'Flight';
      doc.font('Helvetica-Bold').fontSize(14).text(title);
      doc.font('Helvetica').fontSize(12);
      doc.text(
        `${segment.flightNumber} - ${segment.airlineName} - ${CABIN_NAMES[segment.cabinClass] ?? segment.cabinClass}`,
      );
      doc.text(
        `Departure: ${segment.departureAirport.code}  ${localTime(segment.departureAt, segment.departureAirport.timeZone)}`,
      );
      doc.text(
        `Arrival:   ${segment.arrivalAirport.code}  ${localTime(segment.arrivalAt, segment.arrivalAirport.timeZone)}`,
      );
      doc.text(
        `Baggage: ${segment.freeBags} free bag(s) per passenger, up to ${segment.maxBagWeightKg} kg each`,
      );
      doc.moveDown();
    });

    doc.font('Helvetica-Bold').fontSize(14).text('Passengers');
    doc.font('Helvetica').fontSize(12);
    for (const p of ticket.passengers) {
      const extra =
        p.extraBags.length > 0
          ? `, extra bags: ${p.extraBags.map((b) => `${b.weightKg} kg`).join(', ')}`
          : '';
      doc.text(
        `${p.fullName} (${p.type}) - passport/ID ${p.passportNumber}${extra}`,
      );
    }
    doc.moveDown();
    doc.text(`Total paid: ${formatMoney(ticket.totalAmount, ticket.currency)}`);

    doc.end();
  });
}

// "2026-12-01 20:35 (Africa/Cairo)": the time at the airport, not the server's time.
export function localTime(date: Date, timeZone: string): string {
  const local = DateTime.fromJSDate(date, { zone: timeZone });
  return local.isValid
    ? `${local.toFormat('yyyy-MM-dd HH:mm')} (${timeZone})`
    : `${DateTime.fromJSDate(date, { zone: 'utc' }).toFormat('yyyy-MM-dd HH:mm')} (UTC)`;
}

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}
