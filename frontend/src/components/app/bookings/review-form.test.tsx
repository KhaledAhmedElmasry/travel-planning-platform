// P-23 review section (HTL-23, GEN-03, GEN-16). Fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ReviewSection, type OwnReview } from "./review-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

// source: openapi HotelBookingDetails.review = ReviewResponse + hidden (backend PR, HTL-23)
const review: OwnReview = {
  id: "rv1",
  rating: 4,
  text: "Great view of the Nile.",
  author: { name: "Mona" },
  date: "2027-03-06T10:00:00.000Z",
  reply: null,
  hidden: false,
};

function json(status: number, body: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}
function apiError(statusCode: number, message: string) {
  return { statusCode, error: "x", message, path: "/", timestamp: "2027-03-06T10:00:00.000Z" };
}
const textBox = () => screen.getByRole("textbox", { name: "Review (optional)" });
const star = (n: number) => fireEvent.click(screen.getByRole("radio", { name: n === 1 ? "1 star" : `${n} stars` }));

// source: Excel HTL-23 - a review per Completed reservation; team leader (Q3) - Confirmed shows a hint,
// other statuses nothing
test("a Confirmed reservation shows only the hint, no form", () => {
  render(<ReviewSection bookingId="hb1" status="confirmed" review={null} />);
  expect(screen.getByText("You can review your stay after check-out.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
});

test.each(["pending_payment", "expired", "cancelled"])("a %s reservation shows no review section", (status) => {
  const { container } = render(<ReviewSection bookingId="hb1" status={status} review={null} />);
  expect(container.textContent).toBe("");
});

// source: Excel HTL-23 - rating 1-5 and optional review; team leader (Q4) - heading and labels
test("a Completed reservation without a review shows the form under the heading Your review", () => {
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);
  const section = screen.getByRole("region", { name: "Your review" });
  expect(within(section).getByRole("radiogroup", { name: "Rating" })).toBeDefined();
  expect(textBox()).toBeDefined();
  expect(within(section).getByRole("button", { name: "Post review" })).toBeDefined();
});

// source: team leader (Q5) - no rating -> inline error, nothing sent
test("posting without a rating shows the inline error and sends nothing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);

  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  expect(await screen.findByText("Choose a rating from 1 to 5.")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel HTL-23 "optional review (max 1000 characters)"; team leader (Q6) - maxLength + live counter
test("the review text is limited to 1000 characters with a live counter", () => {
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);
  expect(textBox().getAttribute("maxLength")).toBe("1000");
  expect(screen.getByText("0/1000")).toBeDefined();
  fireEvent.change(textBox(), { target: { value: "Lovely" } });
  expect(screen.getByText("6/1000")).toBeDefined();
});

// source: openapi POST /api/hotel-bookings/{id}/review {rating, text?}; team leader (Q7, Q11) - trimmed text, toast, refresh
test("posting sends the rating and the trimmed text, then shows the success toast and reloads", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(201, review));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);

  star(4);
  fireEvent.change(textBox(), { target: { value: "  Great view of the Nile.  " } });
  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/hotel-bookings/hb1/review");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ rating: 4, text: "Great view of the Nile." });
  expect(toast.success).toHaveBeenCalledWith("Review posted");
});

// source: team leader (Q7) - empty or blank text is left out of the POST
test("blank text is not sent", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(201, review));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);

  star(5);
  fireEvent.change(textBox(), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ rating: 5 });
});

// source: openapi 409 "The reservation is not Completed, or it already has a review."; team leader (Q10) - backend message inline
test("a backend error shows its message in an alert above the form", async () => {
  const message = "The reservation is not Completed, or it already has a review.";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, apiError(409, message))));
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);

  star(3);
  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  expect((await screen.findByRole("alert")).textContent).toContain(message);
  expect(toast.success).not.toHaveBeenCalled();
  expect(router.refresh).not.toHaveBeenCalled();
});

// source: team leader (Q10) - network / 5xx -> generic text
test.each([
  ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["a server error", () => Promise.resolve(json(500, apiError(500, "Internal server error")))],
])("%s shows the generic error", async (_name, impl) => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(impl));
  render(<ReviewSection bookingId="hb1" status="completed" review={null} />);

  star(3);
  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Something went wrong. Try again.");
});

// source: Excel HTL-23 "later edit or delete it"; your decision - the posted review in ReviewCard with Edit and Delete
test("a posted review is shown as a card with Edit and Delete, and no form", () => {
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);
  const section = screen.getByRole("region", { name: "Your review" });
  expect(within(section).getByRole("article").textContent).toContain("Great view of the Nile.");
  expect(within(section).getByRole("img", { name: "Rated 4 out of 5" })).toBeDefined();
  expect(within(section).getByRole("button", { name: "Edit" })).toBeDefined();
  expect(within(section).getByRole("button", { name: "Delete" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
});

// source: team leader (Q14, Q15) - hidden badge with Edit/Delete still offered; the hotel's reply is shown
test("a review hidden by an admin shows the Hidden badge and the hotel's reply, and can still be edited or deleted", () => {
  const replied = { ...review, hidden: true, reply: { text: "Thank you for staying with us!", date: "2027-03-07T10:00:00.000Z" } };
  render(<ReviewSection bookingId="hb1" status="completed" review={replied} />);
  const card = screen.getByRole("article");
  expect(card.textContent).toContain("Hidden");
  expect(card.textContent).toContain("Thank you for staying with us!");
  expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
});

// source: team leader decision - Edit goes back to the form with the current values; Cancel returns to the card
test("Edit opens the form with the current rating and text; Cancel goes back to the card without saving", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect((screen.getByRole("radio", { name: "4 stars" }) as HTMLInputElement).checked).toBe(true);
  expect((textBox() as HTMLTextAreaElement).value).toBe("Great view of the Nile.");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDefined();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("article")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: openapi PATCH /api/reviews/{id} "send only the fields to change"; team leader (Q9, Q11)
test("saving sends only the changed fields, then shows the success toast and reloads", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { ...review, rating: 2 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  star(2);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/reviews/rv1");
  expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ rating: 2 });
  expect(toast.success).toHaveBeenCalledWith("Review updated");
  expect(screen.getByRole("article")).toBeDefined();
});

// source: team leader (24 Nov) - after "Save changes" the card shows the new values at once (the PATCH 200 body),
// router.refresh() still follows; the Hidden flag (not in the PATCH body) is kept
test("after saving, the card shows the review returned by the backend right away", async () => {
  const updated = { id: "rv1", rating: 2, text: "Noisy at night.", author: { name: "Mona" }, date: review.date, reply: null };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, updated)));
  render(<ReviewSection bookingId="hb1" status="completed" review={{ ...review, hidden: true }} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  star(2);
  fireEvent.change(textBox(), { target: { value: "Noisy at night." } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  const card = await screen.findByRole("article");
  expect(within(card).getByRole("img", { name: "Rated 2 out of 5" })).toBeDefined();
  expect(card.textContent).toContain("Noisy at night.");
  expect(card.textContent).not.toContain("Great view of the Nile.");
  expect(card.textContent).toContain("Hidden");
});

// source: team leader (Q8) - editing may clear the text (sends text "")
test("clearing the text while editing sends an empty text", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(200, { ...review, text: "" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(textBox(), { target: { value: "  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "" });
});

// source: team leader (Q9) - no change -> just close, no request
test("saving without changes just closes the form", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(screen.getByRole("article")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: openapi 403 "Not the author of this review."; team leader (Q10)
test("an edit error shows the backend message above the form and keeps the form open", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, apiError(404, "Review not found."))));
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  star(1);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Review not found.");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDefined();
});

// source: Excel GEN-03 + openapi DELETE /api/reviews/{id} (frontend confirms first); team leader (Q12, Q13)
test("Delete asks for confirmation first, then deletes, shows the toast and reloads", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(204, null));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByText("Delete your review?")).toBeDefined();
  expect(dialog.textContent).toContain(
    "Your rating is removed from the hotel's average. You can write a new review for this stay afterwards.",
  );
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "Delete review" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/reviews/rv1");
  expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  expect(toast.success).toHaveBeenCalledWith("Review deleted");
});

// source: team leader (Q13) - after a delete the empty form shows again (the page reloads with review null)
test("after the delete the reloaded page shows the empty form again", () => {
  const { rerender } = render(<ReviewSection bookingId="hb1" status="completed" review={review} />);
  rerender(<ReviewSection bookingId="hb1" status="completed" review={null} />);
  expect(screen.getByRole("button", { name: "Post review" })).toBeDefined();
  expect((textBox() as HTMLTextAreaElement).value).toBe("");
  expect(screen.getByRole("radio", { name: "1 star" })).toBeDefined();
  expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false);
});

// source: Excel GEN-16 error feedback; ConfirmDialog stays open on error (kit)
test("a delete error shows the backend message as an error toast and does not reload", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(403, apiError(403, "Not the author of this review."))));
  render(<ReviewSection bookingId="hb1" status="completed" review={review} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete review" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not the author of this review."));
  expect(router.refresh).not.toHaveBeenCalled();
});
