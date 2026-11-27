// BudgetSummary (ITN-14 totals by category and by day, ITN-18 conversion with rate date). Faked: next/navigation.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/my/itineraries/it1", useSearchParams: () => new URLSearchParams(),
}));

import { BudgetSummary, type Summary } from "./budget-summary";

afterEach(cleanup);

// source: openapi BudgetSummary (totalsByCategory, totalsByDay, intercityTransport, grandTotal, convertedTotal);
// categories from openapi BudgetCategory; currencies from Mock Data UPDATED Countries.csv (EGP, USD)
const summary: Summary = {
  totalsByCategory: { food: { EGP: 100 }, activities: { EGP: 25.5 } },
  totalsByDay: [
    { dayId: "d1", dayNumber: 1, date: "2027-03-01", totals: { EGP: 125.5 } },
    { dayId: "d2", dayNumber: 2, date: "2027-03-02", totals: { USD: 300 } },
  ],
  intercityTransport: { USD: 300 },
  grandTotal: { EGP: 125.5, USD: 300 },
  convertedTotal: null,
};

/** The <dd> next to the first <dt> with this text inside `scope`. */
function totalOf(scope: HTMLElement, name: string | RegExp) {
  const term = within(scope).getAllByText(name, { selector: "dt" })[0];
  return term.nextElementSibling!.textContent ?? "";
}

test("the total budget is broken down by category, intercity transport and day", () => {
  // source: Excel UPDATED ITN-14 "show the itinerary's total budget broken down by category and by day. Totals include ...
  // activity costs (counted under Activities) and intercity transport entries (ITN-16)"
  const { container } = render(<BudgetSummary summary={summary} />);
  expect(totalOf(container, "Food")).toMatch(/^EGP\s100\.00$/);
  expect(totalOf(container, "Activities")).toMatch(/^EGP\s25\.50$/);
  expect(totalOf(container, "Intercity transport")).toMatch(/^USD\s300\.00$/);
  expect(totalOf(container, "Total")).toMatch(/^EGP\s125\.50\s*USD\s300\.00$/);
  expect(totalOf(container, /^Day 1/)).toMatch(/^EGP\s125\.50$/);
  expect(totalOf(container, /^Day 2/)).toMatch(/^USD\s300\.00$/);
});

test("converted totals show the target currency, the rate date and the stale-rates notice", () => {
  // source: Excel UPDATED ITN-18 "convert all itinerary budget amounts to the user's preferred currency ... and show the rate date.
  // If the API is unavailable, the last cached rates are used"; openapi ConvertedBudgetSummary (rateDate, ratesNotice)
  render(<BudgetSummary summary={{
    ...summary,
    convertedTotal: {
      currency: "USD", rateDate: "2027-02-28", ratesNotice: "Live rates are unavailable; showing the last saved rates.",
      totalsByCategory: { food: { USD: 2 }, activities: { USD: 0.5 } },
      totalsByDay: [{ dayId: "d1", dayNumber: 1, date: "2027-03-01", totals: { USD: 2.5 } }],
      intercityTransport: { USD: 300 }, grandTotal: { USD: 302.5 },
    },
  }} />);

  const converted = screen.getByRole("heading", { name: "Converted to USD" }).parentElement!;
  expect(within(converted).getByText(/28 Feb 2027/)).toBeTruthy();
  expect(within(converted).getByRole("status").textContent).toBe("Live rates are unavailable; showing the last saved rates.");
  expect(totalOf(converted, "Total")).toMatch(/^USD\s302\.50$/);
  expect(totalOf(converted, "Food")).toMatch(/^USD\s2\.00$/);
});

test("without budget amounts there are no totals to show", () => {
  // source: Excel UPDATED ITN-14 totals come from budget entries, activity costs and transport entries (none here)
  const empty: Summary = { totalsByCategory: {}, totalsByDay: [], intercityTransport: {}, grandTotal: {}, convertedTotal: null };
  const { container } = render(<BudgetSummary summary={empty} />);
  expect(container.querySelectorAll("dt")).toHaveLength(0);
});
