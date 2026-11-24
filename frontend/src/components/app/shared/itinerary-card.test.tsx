// ItineraryCard: one itinerary in My itineraries (ITN-03), public search (ITN-21), the author page
// (BLG-12) and a post's attached itinerary (BLG-13). Pure display, nothing faked.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ItineraryCard, type ItinerarySummary } from "./itinerary-card";

afterEach(cleanup);

// source: backend itineraries.service.ts ItinerarySummary (GET /api/itineraries, public search, author page)
const trip: ItinerarySummary = {
  id: "i1",
  title: "Cairo and Dubai in spring",
  countryCodes: ["EG", "AE"],
  startDate: "2027-03-01",
  numberOfDays: 5,
  visibility: "private",
};

// source: Excel ITN-03 - list title, countries, start date, days; open it to view details
test("shows the title as a link, the countries, the start date and the number of days", () => {
  render(<ItineraryCard itinerary={trip} href="/my/itineraries/i1" />);

  const link = screen.getByRole("link", { name: "Cairo and Dubai in spring" });
  expect(link.getAttribute("href")).toBe("/my/itineraries/i1");
  const card = screen.getByRole("article");
  expect(card.textContent).toContain("EG, AE");
  expect(card.textContent).toContain("Mon, 1 Mar 2027");
  expect(card.textContent).toContain("5 days");
});

// source: Excel ITN-03 - days (one day reads "1 day")
test("one day is written in the singular", () => {
  render(<ItineraryCard itinerary={{ ...trip, numberOfDays: 1 }} href="/x" />);

  expect(screen.getByRole("article").textContent).toContain("1 day");
  expect(screen.getByRole("article").textContent).not.toContain("1 days");
});

// source: Excel ITN-03 - visibility in the owner's list
test("the owner's list shows the visibility", () => {
  const { rerender } = render(<ItineraryCard itinerary={trip} href="/x" showVisibility />);
  expect(screen.getByText("Private")).toBeTruthy();

  rerender(<ItineraryCard itinerary={{ ...trip, visibility: "public" }} href="/x" showVisibility />);
  expect(screen.getByText("Public")).toBeTruthy();
});

// source: Excel ITN-21/BLG-12 - public lists: every card is public, so no visibility pill
test("public lists do not show the visibility", () => {
  render(<ItineraryCard itinerary={{ ...trip, visibility: "public" }} href="/itineraries/i1" />);

  expect(screen.queryByText("Public")).toBeNull();
});

// source: spec section 1 - content an admin hid shows a "Hidden" badge to its author and admins (GEN-10)
test("hidden content shows the Hidden badge", () => {
  render(<ItineraryCard itinerary={trip} href="/x" hidden />);

  expect(screen.getByText("Hidden")).toBeTruthy();
});
