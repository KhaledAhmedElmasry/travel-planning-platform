// P-01 Sign up form (ACC-01, ACC-02 bonus toast, ACC-10). Only fetch, navigate and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

import { SignupForm } from "./signup-form";

// jsdom has no ResizeObserver; the Radix checkbox needs one (browser API, not our code).
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toastSuccess.mockReset();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const created = { id: "u1", name: "Mona Ali", email: "mona@example.com", role: "user", status: "active", createdAt: "2026-11-23T10:00:00.000Z" };
const loggedIn = { id: "u1", name: "Mona Ali", email: "mona@example.com", role: "user", mustChangePassword: false };

function fill({ consent = true } = {}) {
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Mona Ali" } });
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "mona@example.com" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "Secret123" } });
  if (consent) fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
}

// source: Excel ACC-01 - register with name, email, password and the mandatory consent;
// team leader in chat (23 Nov): then log in automatically and land on /home, with a "check your email" toast (ACC-02)
test("a guest signs up, is logged in and lands on /home with the verify-email toast", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(201, created)).mockResolvedValueOnce(jsonResponse(200, loggedIn));
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<SignupForm navigate={navigate} />);

  fill();

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/home"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/register");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Mona Ali", email: "mona@example.com", password: "Secret123", acceptTerms: true });
  expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/login");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ email: "mona@example.com", password: "Secret123" });
  expect(toastSuccess).toHaveBeenCalledWith("Check your email to verify your account");
});

// source: Excel ACC-10 + team leader in chat (23 Nov) - the pending action survives sign-up
test("after sign-up the new user returns to the pending action", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(201, created)).mockResolvedValueOnce(jsonResponse(200, loggedIn)));
  const navigate = vi.fn();
  render(<SignupForm returnTo="/hotels/h1/book" navigate={navigate} />);

  fill();

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/hotels/h1/book"));
});

// source: Excel ACC-01 - "reject the form with an inline error if the email is invalid or already registered,
// the password breaks these rules, or consent is not given" (GEN-02: under each field)
test.each([
  ["name", /^name/i, "Name is required"],
  ["email", /^email/i, "Email is already registered"],
  ["password", /^password/i, "Password must be at least 8 characters long and include at least one letter and one digit"],
  ["acceptTerms", null, "You must accept the terms and privacy policy to register"],
])("a backend error on %s is shown under that field and nobody is logged in", async (field, label, message) => {
  const body = { statusCode: 400, error: "x", message: "Validation failed", fieldErrors: [{ field, messages: [message] }] };
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, body));
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<SignupForm navigate={navigate} />);

  fill({ consent: field !== "acceptTerms" });

  await screen.findByRole("alert");
  const input = label ? screen.getByLabelText(label) : screen.getByRole("checkbox");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toBe(message);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
});

// source: Excel ACC-01 - consent not given: the form sends acceptTerms false and the backend refuses it
test("an unticked consent box is sent as false", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { statusCode: 400, error: "x", message: "Validation failed" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<SignupForm navigate={vi.fn()} />);

  fill({ consent: false });

  await screen.findByRole("alert");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).acceptTerms).toBe(false);
});

// source: Excel ACC-01 - password rule (8+ characters, a letter, a digit); spec P-01 "live rule hint"
test("the password field lists the password rules", () => {
  render(<SignupForm navigate={vi.fn()} />);

  expect(screen.getByText("8 characters or more")).toBeDefined();
  expect(screen.getByText("At least 1 letter")).toBeDefined();
  expect(screen.getByText("At least 1 digit")).toBeDefined();
});

// source: team leader in chat (23 Nov) - the Terms & Privacy link opens /terms in a new tab (form kept, GEN-15)
test("the consent label links to /terms in a new tab", () => {
  render(<SignupForm navigate={vi.fn()} />);

  const link = screen.getByRole("link", { name: /terms & privacy policy/i });
  expect(link.getAttribute("href")).toBe("/terms");
  expect(link.getAttribute("target")).toBe("_blank");
});

// source: Excel ACC-10 + team leader in chat (23 Nov) - the pending action survives switching to log in
test("the Log in link keeps the pending action", () => {
  render(<SignupForm returnTo="/bookings" navigate={vi.fn()} />);

  expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?returnTo=%2Fbookings");
});

// source: Excel GEN-16 - loading feedback on every action
test("the button is disabled while signing up", async () => {
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
  render(<SignupForm navigate={vi.fn()} />);

  fill();

  await waitFor(() => expect(screen.getByRole("button", { name: "Sign up" }).hasAttribute("disabled")).toBe(true));
});
