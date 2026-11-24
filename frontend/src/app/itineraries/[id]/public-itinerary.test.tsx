// P-28 public itinerary, read-only (ITN-21): author, days, activities and budget.
// Budget as entered, each amount in its own currency, plus per-category totals per currency
// (team leader decision 24 Nov - P-28 budget). Nothing is faked: plain rendering.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PublicItineraryView, type PublicItinerary } from "./public-itinerary";

afterEach(cleanup);

// Intl puts a no-break space between the currency code and the amount.
const text = (el: Element) => (el.textContent ?? "").replace(/ /g, " ");

const itinerary: PublicItinerary = {
  id: "665f1c2a9b1e8a00123400a1",
  title: "Nile week",
  countryCodes: ["EG"],
  startDate: "2027-03-01",
  visibility: "public",
  author: { id: "a1", name: "Mona Adel" },
  originalAuthor: null,
  days: [
    {
      id: "d1",
      number: 1,
      date: "2027-03-01",
      cityId: "cairo",
      notes: "Arrive and rest",
      activities: [{ id: "x1", name: "Pyramids", description: "Giza plateau", time: "09:00", cost: 20, currency: "USD" }],
      budgets: [
        { id: "b1", dayId: "d1", category: "food", amount: 250, currency: "EGP", description: "Dinner" },
        { id: "b2", dayId: "d1", category: "food", amount: 10.5, currency: "USD", description: "Lunch" },
      ],
    },
    { id: "d2", number: 2, date: "2027-03-02", cityId: "luxor", notes: "", activities: [], budgets: [] },
  ],
  transportCosts: [{ id: "t1", dayId: "d2", mode: "train", fromCityId: "cairo", toCityId: "luxor", amount: 900, currency: "EGP" }],
  budget: {
    totalsByCategory: {
      food: { EGP: 250, USD: 10.5 },
      accommodation: {},
      in_city_transport: {},
      activities: { USD: 20 },
    },
    intercityTransport: { EGP: 900 },
  },
};

// source: Excel ITN-21 "view a public itinerary read-only with author"; spec P-28 "Author (links to the author page)"
test("shows the title and the author linked to the author page", () => {
  render(<PublicItineraryView itinerary={itinerary} />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Nile week");
  expect(screen.getByRole("link", { name: "Mona Adel" }).getAttribute("href")).toBe("/authors/a1");
});

// source: Excel ITN-21 "days, activities"; openapi PublicItinerary days[].activities
test("lists every day with its date, city, notes and activities", () => {
  render(<PublicItineraryView itinerary={itinerary} />);

  const days = screen.getAllByRole("region", { name: /^Day / });
  expect(days.map((d) => d.getAttribute("aria-label"))).toEqual(["Day 1", "Day 2"]);
  const day1 = within(days[0]);
  expect(day1.getByText("Mon, 1 Mar 2027")).toBeTruthy();
  expect(day1.getByText("cairo")).toBeTruthy();
  expect(day1.getByText("Arrive and rest")).toBeTruthy();
  expect(day1.getByText("Pyramids")).toBeTruthy();
  expect(day1.getByText("09:00")).toBeTruthy();
  expect(day1.getByText("Giza plateau")).toBeTruthy();
  expect(day1.getByText("USD 20.00")).toBeTruthy();
});

// source: team leader decision 24 Nov - P-28 budget "entries AS ENTERED, each in its own currency"
test("shows each budget entry and transport cost in its own currency on its day", () => {
  render(<PublicItineraryView itinerary={itinerary} />);

  const [day1, day2] = screen.getAllByRole("region", { name: /^Day / });
  const rows = within(day1).getAllByRole("listitem").map(text);
  expect(rows).toContain("Food · DinnerEGP 250.00");
  expect(rows).toContain("Food · LunchUSD 10.50");
  expect(text(within(day2).getByRole("listitem"))).toBe("Train · cairo → luxorEGP 900.00");
});

// source: team leader decision 24 Nov - P-28 budget "per-category totals per currency", no conversion
test("budget totals per category, per currency, empty categories left out", () => {
  render(<PublicItineraryView itinerary={itinerary} />);

  const totals = within(screen.getByRole("region", { name: "Budget" }));
  expect(totals.getAllByRole("row").map(text)).toEqual([
    "CategoryTotal",
    "FoodEGP 250.00USD 10.50",
    "ActivitiesUSD 20.00",
    "Intercity transportEGP 900.00",
  ]);
});

// source: Excel ITN-21 "the clone ... credits the original author" (shown when a clone was made public)
test("a clone credits the original author", () => {
  render(<PublicItineraryView itinerary={{ ...itinerary, originalAuthor: { id: "o9", name: "Sara Ali" } }} />);

  expect(screen.getByRole("link", { name: "Sara Ali" }).getAttribute("href")).toBe("/authors/o9");
});
