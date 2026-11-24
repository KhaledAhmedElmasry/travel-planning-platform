// P-02 Log in form (ACC-04, ACC-05, ACC-10). Only the network (fetch) and the page change (navigate) are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function account(role: string, mustChangePassword = false) {
  return { id: "u1", name: "Demo", email: "demo.user@yallaway.local", role, mustChangePassword };
}

function logIn(email = "demo.user@yallaway.local", password = "Secret123") {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

// source: Excel ACC-04 - "log in with email and password and land on their role's home page";
// role home paths confirmed by the team leader in chat (23 Nov): user -> /home
test("a registered user who logs in lands on /home", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, account("user")));
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<LoginForm navigate={navigate} />);

  logIn();

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/home"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/auth/login");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ email: "demo.user@yallaway.local", password: "Secret123" });
  expect(navigate).toHaveBeenCalledWith("/home");
});

// source: Excel ACC-04 - land on the role's home page; paths confirmed by the team leader in chat (23 Nov)
test.each([
  ["admin", "/admin"],
  ["airline_moderator", "/airline"],
  ["hotel_moderator", "/hotel"],
])("a %s who logs in lands on %s", async (role, home) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, account(role))));
  const navigate = vi.fn();
  render(<LoginForm navigate={navigate} />);

  logIn();

  await waitFor(() => expect(navigate).toHaveBeenCalledWith(home));
});

// source: Excel ACC-10 - a guest sent to login is returned "to that action afterwards"
test("after login the user returns to the pending action", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, account("user"))));
  const navigate = vi.fn();
  render(<LoginForm returnTo="/hotels/h1/book?rooms=2" navigate={navigate} />);

  logIn();

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/hotels/h1/book?rooms=2"));
});

// source: Excel ACC-07a / ACC-13 - a temporary password must be replaced at the next login;
// team leader in chat (23 Nov): go to /account/password first and keep the pending action
test("an account with a temporary password goes to /account/password and keeps the pending action", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, account("user", true))));
  const navigate = vi.fn();
  render(<LoginForm returnTo="/bookings" navigate={navigate} />);

  logIn();

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/account/password?returnTo=%2Fbookings"));
});

function apiError(statusCode: number, message: string, fieldErrors?: { field: string; messages: string[] }[]) {
  return { statusCode, error: "x", message, ...(fieldErrors ? { fieldErrors } : {}) };
}

// source: Excel ACC-04 - "On failure it shall show a generic 'invalid email or password' message";
// team leader in chat (23 Nov): show the backend's message text
test("wrong email or password shows the generic message and stays on the page", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, apiError(401, "Invalid email or password"))));
  const navigate = vi.fn();
  render(<LoginForm navigate={navigate} />);

  logIn();

  expect((await screen.findByRole("alert")).textContent).toContain("Invalid email or password");
  expect(navigate).not.toHaveBeenCalled();
});

// source: Excel ACC-04 - "Suspended accounts shall see an 'account suspended' message"
test("a suspended account sees the account suspended message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, apiError(403, "Account suspended"))));
  const navigate = vi.fn();
  render(<LoginForm navigate={navigate} />);

  logIn();

  expect((await screen.findByRole("alert")).textContent).toContain("Account suspended");
  expect(navigate).not.toHaveBeenCalled();
});

// source: Excel ACC-05 - after 5 failed attempts the account is locked for 15 minutes "and show a lockout message"
test("a locked account sees the lockout message", async () => {
  const text = "Account locked after 5 failed login attempts. Try again in 15 minutes";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, apiError(403, text))));
  render(<LoginForm navigate={vi.fn()} />);

  logIn();

  expect((await screen.findByRole("alert")).textContent).toContain(text);
});

// source: Excel GEN-02 - field-level validation messages next to each field
test("a field error from the backend is shown under that field", async () => {
  const body = apiError(400, "Validation failed", [{ field: "email", messages: ["email must be an email"] }]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  render(<LoginForm navigate={vi.fn()} />);

  logIn("not-an-email");

  await screen.findByRole("alert");
  const field = screen.getByLabelText(/email/i);
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(field.getAttribute("aria-describedby")!)?.textContent).toBe("email must be an email");
});

// source: Excel GEN-16 - loading feedback on every action
test("the button is disabled while logging in", async () => {
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
  render(<LoginForm navigate={vi.fn()} />);

  logIn();

  await waitFor(() => expect(screen.getByRole("button", { name: "Log in" }).hasAttribute("disabled")).toBe(true));
});

// source: team leader in chat (23 Nov) - show the "Forgot password?" link (ACC-07 bonus) now;
// Excel ACC-01 - guests register (sign-up page /signup, route merged in #258)
test("the form links to sign up and to forgot password", () => {
  render(<LoginForm navigate={vi.fn()} />);

  expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup");
});

// source: Excel ACC-10 + team leader in chat (23 Nov) - the pending action survives switching to sign up
test("the Sign up link keeps the pending action", () => {
  render(<LoginForm returnTo="/bookings" navigate={vi.fn()} />);

  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup?returnTo=%2Fbookings");
});
