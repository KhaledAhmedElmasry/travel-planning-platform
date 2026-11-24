// P-28 (ITN-21): the read-only public itinerary: author, days, activities and budget.
// Budget: every entry AS ENTERED in its own currency, plus per-category totals per currency and a grand
// total per currency; no currency conversion on the public page. Full country and city names, activity images.
// source: team leader decision 24 Nov - P-28 budget; team leader answers 24 Nov - names, images, grand total
// Server-rendered (no "use client"): the page is cached for everyone (ISR); `actions` holds the
// interactive buttons (Clone, Save, Report).
import Link from "next/link";
import type { ReactNode } from "react";
import { BudgetAmount } from "@/components/app/budget-amount";
import { PageHeader } from "@/components/app/page-header";
import { formatDay } from "@/lib/dates";

type Totals = Record<string, number>;
type Category = "food" | "accommodation" | "in_city_transport" | "activities";

/** backend itineraries.service.ts PublicItineraryResponse (only the fields this page shows). */
export type PublicItinerary = {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  visibility: "public" | "private";
  author: { id: string; name: string };
  originalAuthor: { id: string; name: string } | null;
  days: {
    id: string;
    number: number;
    date: string;
    cityId: string;
    notes: string;
    activities?: {
      id: string;
      name: string;
      description: string;
      time?: string;
      cost?: number;
      currency?: string;
      images?: { id: string; url: string }[];
    }[];
    budgets?: { id: string; dayId: string; category: Category; amount: number; currency: string; description: string }[];
  }[];
  transportCosts: { id: string; dayId: string; mode: string; fromCityId: string; toCityId: string; amount: number; currency: string }[];
  budget: { totalsByCategory: Record<Category, Totals>; intercityTransport: Totals; grandTotal: Totals };
};

// source: spec 3.7 P-26 budget categories "food, accommodation, in-city transport, activities"
const CATEGORY: Record<Category, string> = {
  food: "Food",
  accommodation: "Accommodation",
  in_city_transport: "In-city transport",
  activities: "Activities",
};
// backend TransportMode values, capitalised.
const mode = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Amounts({ totals }: { totals: Totals }) {
  return (
    <span className="flex flex-wrap gap-x-3">
      {Object.entries(totals).map(([currency, amount]) => (
        <BudgetAmount key={currency} amount={amount} currency={currency} />
      ))}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </li>
  );
}

type ViewProps = {
  itinerary: PublicItinerary;
  actions?: ReactNode;
  /** code -> name (GET /api/countries); a code missing from the map is shown as the code. */
  countryNames?: Record<string, string>;
  /** cityId -> name (GET /api/cities); an id missing from the map is shown as the id. */
  cityNames?: Record<string, string>;
};

export function PublicItineraryView({ itinerary: it, actions, countryNames = {}, cityNames = {} }: ViewProps) {
  const city = (id: string) => cityNames[id] ?? id;
  const totals: [string, Totals][] = [
    ...(Object.keys(CATEGORY) as Category[]).map((c): [string, Totals] => [CATEGORY[c], it.budget.totalsByCategory[c] ?? {}]),
    ["Intercity transport", it.budget.intercityTransport] as [string, Totals],
  ].filter(([, t]) => Object.keys(t).length > 0);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={it.title}
        description={
          <span className="grid gap-1">
            <span>
              By <Link href={`/authors/${it.author.id}`} className="text-link hover:underline">{it.author.name}</Link>
              {" · "}
              {it.countryCodes.map((code) => countryNames[code] ?? code).join(", ")} · {formatDay(it.startDate)}
            </span>
            {it.originalAuthor && (
              // source: team leader answer 24 Nov - attribution wording
              <span>
                Cloned from an itinerary by{" "}
                <Link href={`/authors/${it.originalAuthor.id}`} className="text-link hover:underline">{it.originalAuthor.name}</Link>
              </span>
            )}
          </span>
        }
        actions={actions}
      />

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4">
          {it.days.map((day) => {
            const transport = it.transportCosts.filter((t) => t.dayId === day.id);
            const costs = day.budgets ?? [];
            return (
              <section key={day.id} aria-label={`Day ${day.number}`} className="grid gap-3 rounded-xl border border-border bg-card p-4">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold">Day {day.number}</h2>
                  <span className="flex gap-3 text-sm text-muted-foreground">
                    <span>{formatDay(day.date)}</span>
                    <span>{city(day.cityId)}</span>
                  </span>
                </header>
                {day.notes && <p className="text-sm">{day.notes}</p>}
                {(day.activities ?? []).map((a) => (
                  <article key={a.id} className="grid gap-1 rounded-lg bg-muted p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-medium">{a.name}</h3>
                      <span className="flex gap-3 text-sm">
                        {a.time && <span className="text-muted-foreground">{a.time}</span>}
                        {a.cost !== undefined && a.currency && <BudgetAmount amount={a.cost} currency={a.currency} />}
                      </span>
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                    {(a.images ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(a.images ?? []).map((img) => (
                          // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the backend (same as the kit's ImageUploader)
                          <img key={img.id} src={img.url} alt={a.name} className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {(costs.length > 0 || transport.length > 0) && (
                  <ul className="grid gap-1">
                    {costs.map((b) => (
                      <Row key={b.id} label={b.description ? `${CATEGORY[b.category]} · ${b.description}` : CATEGORY[b.category]}>
                        <BudgetAmount amount={b.amount} currency={b.currency} />
                      </Row>
                    ))}
                    {transport.map((t) => (
                      <Row key={t.id} label={`${mode(t.mode)} · ${city(t.fromCityId)} → ${city(t.toCityId)}`}>
                        <BudgetAmount amount={t.amount} currency={t.currency} />
                      </Row>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <section aria-label="Budget" className="grid h-fit gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Budget</h2>
          {totals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No costs entered.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {totals.map(([label, t]) => (
                  <tr key={label} className="border-t border-border">
                    <th scope="row" className="py-2 text-left font-normal text-muted-foreground">{label}</th>
                    <td className="py-2 text-right"><Amounts totals={t} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <th scope="row" className="py-2 text-left">Grand total</th>
                  <td className="py-2 text-right"><Amounts totals={it.budget.grandTotal} /></td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
