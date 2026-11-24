// StarRating: shows a 1-5 rating (hotel average, review rating) and lets the user pick one (review form).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StarRating } from "./star-rating";

afterEach(cleanup);

// source: Excel HTL-24 - view a hotel's average rating; HTL-12 - rating 1-5
test("display mode reads the rating out of 5 and fills the rounded number of stars", () => {
  render(<StarRating value={4.3} />);

  const img = screen.getByRole("img", { name: "Rated 4.3 out of 5" });
  expect(img.querySelectorAll("[data-filled='true']")).toHaveLength(4);
  expect(img.querySelectorAll("[data-filled='false']")).toHaveLength(1);
});

// source: Excel HTL-24 - average rating shown with one decimal
test("display mode rounds the spoken average to one decimal", () => {
  render(<StarRating value={3.666} />);

  expect(screen.getByRole("img", { name: "Rated 3.7 out of 5" })).toBeTruthy();
});

// source: Excel HTL-23 - submit one rating (1-5)
test("input mode offers exactly the ratings 1 to 5 and reports the chosen one", () => {
  const onChange = vi.fn();
  render(<StarRating value={0} onChange={onChange} label="Your rating" />);

  const group = screen.getByRole("radiogroup", { name: "Your rating" });
  const radios = screen.getAllByRole("radio");
  expect(group).toBeTruthy();
  expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["1", "2", "3", "4", "5"]);

  fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
  expect(onChange).toHaveBeenCalledWith(4);
});

// source: Excel HTL-23 - edit the rating later: the saved value is pre-selected
test("input mode marks the current value as checked", () => {
  render(<StarRating value={2} onChange={vi.fn()} label="Your rating" />);

  expect((screen.getByRole("radio", { name: "2 stars" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("radio", { name: "1 star" }) as HTMLInputElement).checked).toBe(false);
});
