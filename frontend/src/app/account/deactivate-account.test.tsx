// P-06 deactivate my account (ACC-12, GEN-03). Only fetch, navigate and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { DeactivateAccount } from "./deactivate-account";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Deactivate account" }));
  return screen.findByRole("alertdialog");
}

// source: Excel GEN-03 - confirmation before destructive actions; ACC-12 - "after confirmation",
// and the consequences: cannot log in, posts and public itineraries hidden, comments and reviews shown as "Deleted user"
test("deactivating first asks for confirmation and lists the consequences, without calling the backend", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<DeactivateAccount navigate={vi.fn()} />);

  const dialog = await openDialog();

  expect(dialog.textContent).toContain("You will not be able to log in");
  expect(dialog.textContent).toContain("Your posts and public itineraries will be hidden");
  expect(dialog.textContent).toContain('Your comments and reviews will show "Deleted user"');
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel ACC-12; team leader in chat (23 Nov) - then the public home with "Your account has been deactivated"
test("confirming deletes the account and goes to the public home with a message", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<DeactivateAccount navigate={navigate} />);

  const dialog = await openDialog();
  fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Deactivate account")!);

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/users/me");
  expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  expect(toast.success).toHaveBeenCalledWith("Your account has been deactivated");
});

// source: Excel ACC-12 - "Deactivation is blocked while the user has upcoming Confirmed bookings": show that error
test("a user with upcoming bookings sees the backend's reason and stays", async () => {
  const message = "You have upcoming confirmed bookings. Cancel them or wait until they have started before deactivating your account";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 409, error: "CONFLICT", message }), { status: 409 })));
  const navigate = vi.fn();
  render(<DeactivateAccount navigate={navigate} />);

  const dialog = await openDialog();
  fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Deactivate account")!);

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeDefined(); // stays open: the user can back out
});
