// SortSelect (FLT-15, HTL-12). Team leader (23 Nov): one select with the direction in the label.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SortSelect } from "./sort-select";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = () => fireEvent.keyDown(screen.getByRole("combobox", { name: /^sort/i }), { key: "Enter" });

// source: Excel FLT-15 - sort by price, duration or departure time; openapi FlightSortBy + SortOrder
test("flights offer price, duration and departure time in both directions", async () => {
  render(<SortSelect kind="flights" value={{ sortBy: "price", sortOrder: "asc" }} onChange={vi.fn()} />);
  open();

  const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
  expect(options).toEqual([
    "Price: low to high",
    "Price: high to low",
    "Duration: shortest",
    "Duration: longest",
    "Departure: earliest",
    "Departure: latest",
  ]);
});

// source: Excel HTL-12 - sort by that price or by rating; openapi HotelSortBy + SortOrder
test("hotels offer price and rating in both directions", async () => {
  render(<SortSelect kind="hotels" value={{ sortBy: "price", sortOrder: "asc" }} onChange={vi.fn()} />);
  open();

  const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
  expect(options).toEqual(["Price: low to high", "Price: high to low", "Rating: highest", "Rating: lowest"]);
});

// source: openapi sortBy / sortOrder query params
test("choosing an option hands over sortBy and sortOrder", async () => {
  const onChange = vi.fn();
  render(<SortSelect kind="flights" value={{ sortBy: "price", sortOrder: "asc" }} onChange={onChange} />);
  open();

  fireEvent.click(await screen.findByRole("option", { name: "Departure: latest" }));

  expect(onChange).toHaveBeenCalledWith({ sortBy: "departure_time", sortOrder: "desc" });
});

// source: openapi - rating "highest" first is descending
test("Rating: highest is rating descending", async () => {
  const onChange = vi.fn();
  render(<SortSelect kind="hotels" value={{ sortBy: "price", sortOrder: "asc" }} onChange={onChange} />);
  open();

  fireEvent.click(await screen.findByRole("option", { name: "Rating: highest" }));

  expect(onChange).toHaveBeenCalledWith({ sortBy: "rating", sortOrder: "desc" });
});

// source: openapi - the current sort comes from the URL
test("shows the current sort", () => {
  render(<SortSelect kind="flights" value={{ sortBy: "duration", sortOrder: "asc" }} onChange={vi.fn()} />);

  expect(screen.getByRole("combobox", { name: /^sort/i }).textContent).toContain("Duration: shortest");
});
