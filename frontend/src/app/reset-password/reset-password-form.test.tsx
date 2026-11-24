// P-10 Reset password form (ACC-07 bonus). Only fetch, navigate, the URL and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
const urlToken = vi.hoisted(() => ({ value: null as string | null }));
const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(urlToken.value === null ? "" : `token=${encodeURIComponent(urlToken.value)}`),
  useRouter: () => ({ push: routerPush }),
}));

import { ResetPasswordForm, ResetPasswordFormFromUrl } from "./reset-password-form";
import { metadata } from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toastSuccess.mockReset();
  routerPush.mockReset();
  urlToken.value = null;
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const INVALID = { statusCode: 400, error: "BAD_REQUEST", message: "The token is invalid, expired or already used, or the new password breaks the rules." };

function fill(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/^confirm new password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
}

// source: openapi POST /api/auth/reset-password {token, newPassword} -> 200, sessions revoked, "Log in with your new password";
// team leader (24 Nov, Q14A + Q19A): go to /login with a success toast that also says every device was logged out
test("a valid link sets the new password and goes to log in with a success toast", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: "Password changed. Log in with your new password" }));
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<ResetPasswordForm token="tok123" navigate={navigate} />);

  fill("Journey2027");

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/reset-password");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "tok123", newPassword: "Journey2027" });
  expect(toastSuccess).toHaveBeenCalledWith("Password changed. Log in with your new password", {
    description: "You were logged out on all devices.",
  });
});

// source: team leader (24 Nov, Q13A) - password rules shown live, like P-01/P-03
test("the new password field shows the password rules", () => {
  render(<ResetPasswordForm token="tok123" navigate={vi.fn()} />);

  expect(screen.getByText("8 characters or more")).toBeTruthy();
});

// source: team leader (24 Nov, Q13A) - confirm field, "Passwords do not match", nothing sent
test("a confirmation that does not match is refused before anything is sent", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ResetPasswordForm token="tok123" navigate={vi.fn()} />);

  fill("Journey2027", "Journey2028");

  expect(screen.getAllByText("Passwords do not match").length).toBeGreaterThan(0);
  expect(screen.getByLabelText(/^confirm new password/i).getAttribute("aria-invalid")).toBe("true");
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel ACC-01 password rule (openapi ResetPasswordRequest.newPassword); team leader (24 Nov, Q15A): rule errors inline
test("a password that breaks the rules shows the backend error under the field and keeps the form", async () => {
  const msg = "Password must be at least 8 characters long and include at least one letter and one digit";
  const body = { statusCode: 400, error: "BAD_REQUEST", message: "Validation failed", fieldErrors: [{ field: "newPassword", messages: [msg] }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  const navigate = vi.fn();
  render(<ResetPasswordForm token="tok123" navigate={navigate} />);

  fill("short");

  await waitFor(() => expect(screen.getByLabelText(/^new password/i).getAttribute("aria-invalid")).toBe("true"));
  expect(screen.getAllByText(msg).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Reset password" })).toBeTruthy();
  expect(navigate).not.toHaveBeenCalled();
});

// source: Excel ACC-07 (expires after 30 min, single-use, invalidated by a newer request); spec P-10 states;
// team leader (24 Nov, Q15A): one "invalid, expired or already used" state with "Request a new link"
test("an invalid, expired or used link replaces the form with a link to request a new one", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, INVALID)));
  render(<ResetPasswordForm token="old" navigate={vi.fn()} />);

  fill("Journey2027");

  await waitFor(() => expect(screen.getByText(/invalid, expired or already used/)).toBeTruthy());
  expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe("/forgot-password");
  expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
});

// source: spec line 462 - error state with the backend message (GEN-02)
test("a server error shows the backend message and keeps the form", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { statusCode: 500, error: "x", message: "Something went wrong" })));
  render(<ResetPasswordForm token="tok123" navigate={vi.fn()} />);

  fill("Journey2027");

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Something went wrong"));
  expect(screen.getByRole("button", { name: "Reset password" })).toBeTruthy();
});

// source: team leader (24 Nov, Q17A) - no token: "This reset link is incomplete" + link to /forgot-password, no form
test("without a token there is no form, only a link to request a new one", () => {
  render(<ResetPasswordFormFromUrl />);

  expect(screen.getByText("This reset link is incomplete.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe("/forgot-password");
  expect(screen.queryByLabelText(/^new password/i)).toBeNull();
});

// source: team leader (24 Nov, Q18A) - the token is removed from the address bar after load, and still used on submit
test("the token is read from the link, removed from the address bar and still sent", async () => {
  urlToken.value = "fromUrl";
  const replaceState = vi.spyOn(window.history, "replaceState");
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: "Password changed. Log in with your new password" }));
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(<ResetPasswordFormFromUrl />);

  expect(replaceState).toHaveBeenCalledWith(null, "", "/reset-password");
  urlToken.value = null; // the URL no longer has it: Next.js re-renders with the new search params
  rerender(<ResetPasswordFormFromUrl />);
  fill("Journey2027");

  await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/login"));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).token).toBe("fromUrl");
  replaceState.mockRestore();
});

// source: team leader (24 Nov, Q21A)
test("the page has a plain title and is not indexed", () => {
  expect(metadata.title).toBe("Reset password");
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
