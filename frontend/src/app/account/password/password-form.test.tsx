// P-03 / P-04 change password form (ACC-08, ACC-07a, ACC-13). Only fetch and navigate are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PasswordForm } from "./password-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText(/^(current|temporary) password/i), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/^confirm new password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

// source: Excel ACC-08 - change the password "by entering the current password and a new one";
// team leader in chat (23 Nov): a normal change stays on the page and shows the backend's success message
test("a normal change sends current + new password and shows the success message", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: "Password changed" }));
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<PasswordForm forced={false} role="user" navigate={navigate} />);

  fill("OldPass123", "NewPass456");

  expect((await screen.findByRole("status")).textContent).toContain("Password changed");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/auth/change-password");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body)).toEqual({ currentPassword: "OldPass123", newPassword: "NewPass456" });
  expect(navigate).not.toHaveBeenCalled();
});

// source: team leader in chat (23 Nov) - a confirm field; mismatch shows "Passwords do not match" under it, nothing is sent
test("a confirm that does not match shows the message under the confirm field and sends nothing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<PasswordForm forced={false} role="user" navigate={vi.fn()} />);

  fill("OldPass123", "NewPass456", "NewPass457");

  await screen.findByRole("alert");
  const field = screen.getByLabelText(/^confirm new password/i);
  expect(document.getElementById(field.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toBe("Passwords do not match");
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel GEN-02 - field-level messages; backend answers a wrong current password as a field error
test("a wrong current password from the backend is shown under the current password field", async () => {
  const body = { statusCode: 400, error: "x", message: "Validation failed", fieldErrors: [{ field: "currentPassword", messages: ["Current password is incorrect"] }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  render(<PasswordForm forced={false} role="user" navigate={vi.fn()} />);

  fill("Wrong1234", "NewPass456");

  await screen.findByRole("alert");
  const field = screen.getByLabelText(/^current password/i);
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(field.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toBe("Current password is incorrect");
});

// source: team leader in chat (23 Nov) - the forced form asks for the temporary password (backend needs currentPassword)
test("the forced form labels the first field Temporary password", () => {
  render(<PasswordForm forced role="user" navigate={vi.fn()} />);

  expect(screen.getByLabelText(/^temporary password/i)).toBeDefined();
  expect(screen.queryByLabelText(/^current password/i)).toBeNull();
});

// source: Excel ACC-10 + team leader in chat (23 Nov) - after a forced change continue to the pending action
test("after a forced change the user continues to the pending action", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { message: "Password changed" })));
  const navigate = vi.fn();
  render(<PasswordForm forced role="user" returnTo="/bookings" navigate={navigate} />);

  fill("Temp12345", "NewPass456");

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/bookings"));
});

// source: Excel ACC-13 + ACC-04 - a new moderator changes the password, then lands on the role home (/airline, team leader 23 Nov)
test("after a forced change without a pending action the moderator lands on the role home", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { message: "Password changed" })));
  const navigate = vi.fn();
  render(<PasswordForm forced role="airline_moderator" navigate={navigate} />);

  fill("Temp12345", "NewPass456");

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/airline"));
});

// source: Excel ACC-01 password rules (8+ characters, a letter, a digit), required for the new password by ACC-08
test("the new password field lists the password rules", () => {
  render(<PasswordForm forced={false} role="user" navigate={vi.fn()} />);

  expect(screen.getByText("8 characters or more")).toBeDefined();
  expect(screen.getByText("At least 1 letter")).toBeDefined();
  expect(screen.getByText("At least 1 digit")).toBeDefined();
});
