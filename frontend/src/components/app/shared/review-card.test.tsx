// ReviewCard: one hotel review (HTL-24) with the hotel's reply (HTL-26) and "Deleted user" for a
// deactivated author (ACC-12). Pure display, nothing faked.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ReviewCard, type HotelReview } from "./review-card";

afterEach(cleanup);

// source: backend reviews.service.ts ReviewResponse (GET /api/hotels/{id}/reviews items)
const review: HotelReview = {
  id: "r1",
  rating: 4,
  text: "Great view of the Nile.",
  author: { name: "Mona Ali" },
  date: "2027-03-10T09:00:00.000Z",
  reply: null,
};

// source: Excel HTL-24 - view reviews; HTL-23 rating 1-5 and optional text
test("shows the rating, the author, the date and the text", () => {
  render(<ReviewCard review={review} />);

  const card = screen.getByRole("article");
  expect(screen.getByRole("img", { name: "Rated 4 out of 5" })).toBeTruthy();
  expect(card.textContent).toContain("Mona Ali");
  expect(card.textContent).toContain("10 Mar 2027");
  expect(card.textContent).toContain("Great view of the Nile.");
});

// source: Excel ACC-12 - a deactivated user's reviews are shown as "Deleted user" (the backend sends that name)
test("a deactivated author is shown as Deleted user", () => {
  render(<ReviewCard review={{ ...review, author: { name: "Deleted user" } }} />);

  expect(screen.getByRole("article").textContent).toContain("Deleted user");
});

// source: Excel HTL-26 (bonus) - the hotel's reply is shown under the review
test("the hotel's reply is shown under the review, only when there is one", () => {
  const { rerender } = render(<ReviewCard review={review} />);
  expect(screen.queryByText("Reply from the hotel")).toBeNull();

  rerender(<ReviewCard review={{ ...review, reply: { text: "Thank you, come back soon!", date: "2027-03-12T09:00:00.000Z" } }} />);
  const reply = screen.getByText("Reply from the hotel").closest("div")!;
  expect(reply.textContent).toContain("Thank you, come back soon!");
  expect(reply.textContent).toContain("12 Mar 2027");
});

// source: Excel HTL-23 - the review text is optional (rating only)
test("a rating without text shows no empty paragraph", () => {
  render(<ReviewCard review={{ ...review, text: null }} />);

  expect(screen.getByRole("article").querySelectorAll("p")).toHaveLength(0);
});

// source: spec section 1 - "Hidden" badge to its author and admins (GEN-10)
test("hidden content shows the Hidden badge", () => {
  render(<ReviewCard review={review} hidden />);

  expect(screen.getByText("Hidden")).toBeTruthy();
});

// source: spec P-18 report button on reviews (GEN-09), P-23 edit/delete own review: pages add their buttons
test("the page's actions are shown in the card", () => {
  render(<ReviewCard review={review} actions={<button type="button">Report</button>} />);

  expect(screen.getByRole("button", { name: "Report" })).toBeTruthy();
});
