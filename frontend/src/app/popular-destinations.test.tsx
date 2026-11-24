// Public home: popular destinations (spec section 2, GEN-12) and featured itineraries.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FeaturedItineraries, PopularDestinations } from "./popular-destinations";

afterEach(cleanup);

// source: backend/src/database/seed-data cities.csv, countries.csv, attractions.csv (official ids)
const cities = [
  { cityId: "cairo", name: "Cairo", countryCode: "EG" },
  { cityId: "dubai", name: "Dubai", countryCode: "AE" },
];
const countries = [
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
];
const attractions = [
  { attractionId: "att-1", name: "Giza Pyramids and Sphinx", cityId: "cairo" },
  { attractionId: "att-2", name: "Burj Khalifa Observation Deck", cityId: "dubai" },
];

// source: MILESTONE2_FRONTEND_SPEC.md section 2 Guest row - cards for the seeded cities, each showing its attraction from Attractions.csv
test("one card per city with its country and its attraction", () => {
  render(<PopularDestinations cities={cities} countries={countries} attractions={attractions} />);

  const cards = within(screen.getByRole("region", { name: "Popular destinations" })).getAllByRole("listitem");
  expect(cards).toHaveLength(2);
  expect(cards[0].textContent).toContain("Cairo");
  expect(cards[0].textContent).toContain("Egypt");
  expect(cards[0].textContent).toContain("Giza Pyramids and Sphinx");
  expect(cards[0].textContent).not.toContain("Burj Khalifa");
  expect(cards[1].textContent).toContain("Dubai");
  expect(cards[1].textContent).toContain("United Arab Emirates");
  expect(cards[1].textContent).toContain("Burj Khalifa Observation Deck");
});

// source: team leader decision 24 Nov - featured itineraries = the newest public itineraries, show 6
test("featured itineraries shows at most 6, each linking to its public page", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: `it${i}`,
    title: `Trip ${i}`,
    countryCodes: ["EG"],
    startDate: "2027-03-01",
    numberOfDays: 3,
    visibility: "public" as const,
  }));
  render(<FeaturedItineraries itineraries={items} countries={countries} />);

  const links = within(screen.getByRole("region", { name: "Featured itineraries" })).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual([
    "/itineraries/it0",
    "/itineraries/it1",
    "/itineraries/it2",
    "/itineraries/it3",
    "/itineraries/it4",
    "/itineraries/it5",
  ]);
});

// source: Excel ITN-21 / ITN-03 card fields (title, countries, start date, days) via ItineraryCard;
// team leader 24 Nov - full country names from GET /api/countries; team leader (Q17) - no visibility
// badge on the public home (they are all public)
test("each featured itinerary is an ItineraryCard with its title, full country names, start date and days, without a visibility badge", () => {
  const items = [
    { id: "it1", title: "Nile and Gulf", countryCodes: ["EG", "AE", "FR"], startDate: "2027-03-01", numberOfDays: 1, visibility: "public" as const },
  ];
  render(<FeaturedItineraries itineraries={items} countries={countries} />);

  const region = screen.getByRole("region", { name: "Featured itineraries" });
  const card = within(region).getByRole("article");
  expect(within(card).getByRole("heading", { name: "Nile and Gulf" })).toBeDefined();
  expect(card.textContent).toContain("Egypt, United Arab Emirates, FR");
  expect(card.textContent).toContain("Mon, 1 Mar 2027");
  expect(card.textContent).toContain("1 day");
  expect(card.textContent).not.toMatch(/public/i);
});

// source: Excel GEN-04 - empty lists show a helpful empty state
test("no public itinerary yet shows an empty state with a way to explore", () => {
  render(<FeaturedItineraries itineraries={[]} countries={countries} />);
  const region = screen.getByRole("region", { name: "Featured itineraries" });
  expect(within(region).getByRole("link", { name: "Explore itineraries" }).getAttribute("href")).toBe("/itineraries");
});
