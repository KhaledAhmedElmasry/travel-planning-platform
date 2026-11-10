import PDFDocument from 'pdfkit';
import type {
  BudgetSummaryResponse,
  CurrencyTotals,
  ItineraryResponse,
} from './itineraries.service';

// Area: Itineraries
// ITN-28 (bonus): the itinerary as a PDF file made with pdfkit: title, countries, start date,
// every day with its city, notes, activities, budget entries and transport costs, and the budget
// totals. Amounts are shown as saved (their own currencies, never converted together). The
// built-in PDF fonts cover Latin text only; characters outside it are replaced by "?".

export interface ItineraryPdfData {
  itinerary: ItineraryResponse;
  budget: BudgetSummaryResponse;
  // City id -> display name (falls back to the id).
  cityNames: Record<string, string>;
}

const CATEGORY_NAMES: Record<string, string> = {
  food: 'Food',
  accommodation: 'Accommodation',
  in_city_transport: 'In-city transport',
  activities: 'Activities',
};

// Standard PDF fonts (WinAnsi) cannot draw other scripts: keep the file valid and readable.
function safe(text: string | undefined | null): string {
  return Array.from((text ?? '').replace(/\s+/g, ' '))
    .map((char) => {
      const code = char.charCodeAt(0);
      const printable =
        (code >= 32 && code <= 126) || (code >= 161 && code <= 255);
      return printable ? char : '?';
    })
    .join('');
}

function money(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function totalsText(totals: CurrencyTotals): string {
  const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);
  return entries.length === 0
    ? '0.00'
    : entries.map(([currency, amount]) => money(amount, currency)).join(' + ');
}

// Builds the PDF in memory and returns its bytes.
export function renderItineraryPdf(data: ItineraryPdfData): Promise<Buffer> {
  const { itinerary, budget, cityNames } = data;
  const city = (id: string) => cityNames[id] ?? id;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const heading = (text: string) => {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(14).text(safe(text));
      doc.font('Helvetica').fontSize(11);
    };

    doc.font('Helvetica-Bold').fontSize(22).text(safe(itinerary.title));
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Countries: ${itinerary.countryCodes.join(', ')}`);
    doc.text(`Start date: ${itinerary.startDate}`);
    doc.text(
      `Days: ${itinerary.days.length}   Visibility: ${itinerary.visibility}`,
    );

    for (const day of itinerary.days) {
      heading(`Day ${day.number} - ${day.date} - ${city(day.cityId)}`);
      if (day.notes) doc.text(`Notes: ${safe(day.notes)}`);

      for (const activity of day.activities ?? []) {
        const cost =
          activity.cost !== undefined && activity.currency
            ? `  (${money(activity.cost, activity.currency)})`
            : '';
        const time = activity.time ? `${activity.time} ` : '';
        doc.text(`- ${time}${safe(activity.name)}${cost}`);
        if (activity.description) {
          doc.fillColor('#555555').text(`  ${safe(activity.description)}`);
          doc.fillColor('black');
        }
      }
      for (const entry of day.budgets ?? []) {
        doc.text(
          `Budget: ${CATEGORY_NAMES[entry.category] ?? entry.category} ${money(entry.amount, entry.currency)}${entry.description ? ` - ${safe(entry.description)}` : ''}`,
        );
      }
      for (const cost of itinerary.transportCosts.filter(
        (item) => item.dayId === day.id,
      )) {
        doc.text(
          `Transport (${cost.mode}): ${city(cost.fromCityId)} to ${city(cost.toCityId)} ${money(cost.amount, cost.currency)}`,
        );
      }
    }

    const linked = itinerary.linkedBookings ?? [];
    if (linked.length > 0) {
      heading('Linked bookings');
      for (const booking of linked) {
        const day = itinerary.days.find((d) => d.id === booking.dayId);
        doc.text(
          `${day ? `Day ${day.number}: ` : ''}${safe(booking.description)}${booking.reference ? ` [${booking.reference}]` : ''} - ${money(booking.amount, booking.currency)}`,
        );
      }
    }

    heading('Budget');
    for (const [category, totals] of Object.entries(budget.totalsByCategory)) {
      doc.text(
        `${CATEGORY_NAMES[category] ?? category}: ${totalsText(totals)}`,
      );
    }
    doc.text(`Intercity transport: ${totalsText(budget.intercityTransport)}`);
    doc.font('Helvetica-Bold').text(`Total: ${totalsText(budget.grandTotal)}`);
    doc.font('Helvetica');
    if (budget.linkedBookings && budget.linkedBookings.items.length > 0) {
      doc.text(
        `Linked bookings: ${totalsText(budget.linkedBookings.total)} (platform currency, not converted)`,
      );
      if (budget.grandTotalWithBookings) {
        doc
          .font('Helvetica-Bold')
          .text(
            `Total with bookings: ${totalsText(budget.grandTotalWithBookings)}`,
          );
        doc.font('Helvetica');
      }
    }

    doc.moveDown();
    doc
      .fontSize(9)
      .fillColor('#777777')
      .text(`Exported ${new Date().toISOString().slice(0, 10)}`);

    doc.end();
  });
}
