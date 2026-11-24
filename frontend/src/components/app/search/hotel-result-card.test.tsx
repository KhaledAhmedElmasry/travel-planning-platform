// HotelResultCard (HTL-11, HTL-12). Spec P-15: photo, name, stars, city and country, price per night
// (cheapest qualifying room), average rating. Team leader (23 Nov): place names from the city /
// country lists, and the card links to /hotels/{id} with the searched dates and guests.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { HotelResultCard, type HotelSearchResult } from "./hotel-result-card";

afterEach(cleanup);

// source: openapi HotelSearchResult; Mock Data cities/countries (cairo, EG)
const hotel: HotelSearchResult = {
  id: "665f1c2a9b1e8a00123400a1",
  name: "Nile View Hotel",
  cityId: "cairo",
  countryCode: "EG",
  starRating: 4,
  photo: "/uploads/hotels/nile.jpg",
  averageRating: 4.5,
  ratingCount: 12,
  pricePerNight: 12000,
  currency: "USD",
  freeRooms: 3,
};
const places = { cityName: "Cairo", countryName: "Egypt" };
const search = { checkIn: "2026-12-01", checkOut: "2026-12-04", guests: 2, rooms: 1 };

// source: spec P-15 result card fields; HTL-12 price per night of the cheapest qualifying room
test("shows the photo, name, stars, place, average rating and price per night", () => {
  render(<HotelResultCard hotel={hotel} {...places} search={search} />);

  const card = screen.getByRole("article", { name: "Nile View Hotel" });
  expect(screen.getByRole("img", { name: "Nile View Hotel" }).getAttribute("src")).toContain("nile.jpg");
  expect(screen.getByLabelText("4 stars")).toBeDefined();
  expect(card.textContent).toContain("Cairo, Egypt");
  expect(card.textContent).toContain("4.5");
  expect(card.textContent).toContain("12 ratings");
  expect(card.textContent).toContain("120.00");
  expect(card.textContent).toContain("per night");
});

// source: team leader (23 Nov) - the card links to the hotel details with the searched dates and guests (P-18 free rooms)
test("links to the hotel details with the searched dates, guests and rooms", () => {
  render(<HotelResultCard hotel={hotel} {...places} search={search} />);

  const href = screen.getByRole("link", { name: /Nile View Hotel/ }).getAttribute("href")!;
  const url = new URL(href, "http://localhost");
  expect(url.pathname).toBe("/hotels/665f1c2a9b1e8a00123400a1");
  expect(Object.fromEntries(url.searchParams)).toEqual({ checkIn: "2026-12-01", checkOut: "2026-12-04", guests: "2", rooms: "1" });
});

// source: openapi HotelSearchResult - ratingCount 0 means no rating yet (HTL-12 "unrated hotels")
test("an unrated hotel says it has no ratings yet", () => {
  render(<HotelResultCard hotel={{ ...hotel, averageRating: 0, ratingCount: 0 }} {...places} search={search} />);

  expect(screen.getByRole("article").textContent).toContain("No ratings yet");
});

// source: openapi HotelSearchResult - photo is nullable
test("a hotel without a photo shows no broken image", () => {
  render(<HotelResultCard hotel={{ ...hotel, photo: null }} {...places} search={search} />);

  expect(screen.queryByRole("img", { name: "Nile View Hotel" })).toBeNull();
});
