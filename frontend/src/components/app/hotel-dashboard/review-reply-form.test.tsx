// Reply box of one review (HTL-26, GEN-02). Fetch, the router and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ReviewReplyForm } from "./review-reply-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  router.refresh.mockReset();
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}
const openForm = () => fireEvent.click(screen.getByRole("button", { name: "Reply" }));
const textBox = () => screen.getByRole("textbox");
const send = () => fireEvent.click(screen.getByRole("button", { name: /send/i }));

// source: Excel Bonus HTL-26 "allow a hotel moderator to reply to a review"
test("the Reply button opens a text box to write the reply", () => {
  render(<ReviewReplyForm reviewId="rv1" />);
  expect(screen.queryByRole("textbox")).toBeNull();
  openForm();
  expect(textBox()).toBeDefined();
});

// source: Project description 8.6 "POST /api/reviews/:id/reply HTL-26 (Optional)"
test("sending a reply posts the typed text to POST /api/reviews/{id}/reply", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(201, {}));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewReplyForm reviewId="rv1" />);
  openForm();
  fireEvent.change(textBox(), { target: { value: "Thank you for staying with us." } });
  send();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/reviews/rv1/reply");
  expect(init.method).toBe("POST");
  expect(Object.values(JSON.parse(init.body as string))).toContain("Thank you for staying with us.");
});

// source: Excel GEN-02 "field-level validation messages on all forms" - an empty reply is flagged on the field
test("an empty reply is flagged on the field and nothing is sent", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ReviewReplyForm reviewId="rv1" />);
  openForm();
  send();

  await waitFor(() => expect(textBox().getAttribute("aria-invalid")).toBe("true"));
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel GEN-02 "field-level validation messages" - the backend's rejection is shown at the field
test("a message from the backend is shown linked to the reply field", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      json(409, { statusCode: 409, error: "Conflict", message: "Backend says no", path: "/", timestamp: "2027-03-06T10:00:00.000Z" }),
    ),
  );
  render(<ReviewReplyForm reviewId="rv1" />);
  openForm();
  fireEvent.change(textBox(), { target: { value: "Thanks!" } });
  send();

  await waitFor(() => expect(textBox().getAttribute("aria-invalid")).toBe("true"));
  const describedBy = (textBox().getAttribute("aria-describedby") ?? "").split(" ");
  const linked = describedBy.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
  expect(linked).toContain("Backend says no");
});
