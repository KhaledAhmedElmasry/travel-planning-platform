// P-09 Forgot password form (ACC-07 bonus). Only fetch is faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";
import { metadata } from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const SENT = "If an account with this email exists, a password reset link was sent";

function submit(email: string) {
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
}

// source: Excel ACC-07 - "request a reset link by email ... the response does not reveal whether the email exists";
// team leader (24 Nov, Q9A): the form is replaced by the backend message verbatim + 30-minute hint + "Back to log in"
test("after sending, the form is replaced by the backend message, the 30-minute hint and a link back to log in", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: SENT }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ForgotPasswordForm />);

  submit("mona@example.com");

  await waitFor(() => expect(screen.getByText(SENT)).toBeTruthy());
  expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/forgot-password");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "mona@example.com" });
  expect(screen.getByText(/expires after 30 minutes/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to log in" }).getAttribute("href")).toBe("/login");
  expect(screen.queryByLabelText(/^email/i)).toBeNull();
});

// source: team leader (24 Nov, Q10A) - "Send again / use a different email" brings the form back, no cooldown
test("send again brings the form back with the email kept, and it can be sent again at once", async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { message: SENT })));
  vi.stubGlobal("fetch", fetchMock);
  render(<ForgotPasswordForm />);
  submit("mona@example.com");
  await waitFor(() => expect(screen.getByText(SENT)).toBeTruthy());

  fireEvent.click(screen.getByRole("button", { name: "Send again or use a different email" }));

  expect((screen.getByLabelText(/^email/i) as HTMLInputElement).value).toBe("mona@example.com");
  submit("other@example.com");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ email: "other@example.com" });
});

// source: openapi 400 ValidationError (fieldErrors) + GEN-02 inline errors
test("an invalid email shows the backend error under the field and keeps the form", async () => {
  const body = { statusCode: 400, error: "BAD_REQUEST", message: "Validation failed", fieldErrors: [{ field: "email", messages: ["Enter a valid email address"] }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  render(<ForgotPasswordForm />);

  submit("nope");

  await waitFor(() => expect(screen.getByLabelText(/^email/i).getAttribute("aria-invalid")).toBe("true"));
  expect(screen.getAllByText("Enter a valid email address").length).toBeGreaterThan(0);
  expect(screen.queryByText(SENT)).toBeNull();
});

// source: spec line 462 - error state; the message comes from the backend (GEN-02)
test("a server error shows the backend message and keeps the form", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { statusCode: 500, error: "x", message: "Something went wrong" })));
  render(<ForgotPasswordForm />);

  submit("mona@example.com");

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Something went wrong"));
  expect(screen.getByLabelText(/^email/i)).toBeTruthy();
});

// source: team leader (24 Nov, Q21A)
test("the page has a plain title and is not indexed", () => {
  expect(metadata.title).toBe("Forgot password");
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
