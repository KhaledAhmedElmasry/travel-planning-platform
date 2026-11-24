// P-05 profile form (ACC-09). Only fetch and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ProfileForm, type Currency, type Profile } from "./profile-form";

// jsdom lacks these browser APIs; the Radix select needs them (not our code).
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const profile: Profile = { name: "Mona Ali", email: "mona@example.com", phone: "+20 100 123 4567", preferredCurrency: "EGP" };
// source: Mock Data / GEN-12 supported currencies (codes from the seeded list)
const currencies: Currency[] = [
  { code: "EGP", name: "Egyptian Pound" },
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US Dollar" },
];

// source: Excel ACC-09 - edit name, phone number and preferred currency; team leader (23 Nov): an always-editable form
test("the form shows the email read-only and the three editable fields filled in", () => {
  render(<ProfileForm profile={profile} currencies={currencies} />);

  expect(screen.getByText("mona@example.com")).toBeDefined();
  expect(screen.queryByRole("textbox", { name: /email/i })).toBeNull();
  expect((screen.getByRole("textbox", { name: /^name/i }) as HTMLInputElement).value).toBe("Mona Ali");
  expect((screen.getByRole("textbox", { name: /^phone/i }) as HTMLInputElement).value).toBe("+20 100 123 4567");
  expect(screen.getByRole("combobox", { name: /preferred currency/i }).textContent).toContain("EGP");
});

// source: Excel ACC-09 - save name, phone and currency together
test("saving sends name, phone and preferred currency", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...profile, name: "Mona A." }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProfileForm profile={profile} currencies={currencies} />);

  fireEvent.change(screen.getByRole("textbox", { name: /^name/i }), { target: { value: "Mona A." } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Profile saved"));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/users/me");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body)).toEqual({ name: "Mona A.", phone: "+20 100 123 4567", preferredCurrency: "EGP" });
});

// source: Excel ACC-09 - preferred currency from the supported list (GEN-12)
test("choosing another currency sends its code", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profile));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProfileForm profile={profile} currencies={currencies} />);

  fireEvent.keyDown(screen.getByRole("combobox", { name: /preferred currency/i }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /EUR/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).preferredCurrency).toBe("EUR");
});

// source: team leader in chat (23 Nov) - an emptied phone field is sent as "" and removes the phone
test("an emptied phone field is sent as an empty string", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...profile, phone: null }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ProfileForm profile={profile} currencies={currencies} />);

  fireEvent.change(screen.getByRole("textbox", { name: /^phone/i }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).phone).toBe("");
});

// source: Excel ACC-09 - "saving only if all fields pass validation"; GEN-02 - message under each field
test.each([
  ["name", /^name/i, "Name cannot be empty"],
  ["phone", /^phone/i, "Phone number must be 7 to 20 characters: digits, spaces, ( ) and -, optionally starting with +"],
])("a backend error on %s is shown under that field", async (field, label, message) => {
  const body = { statusCode: 400, error: "x", message: "Validation failed", fieldErrors: [{ field, messages: [message] }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  render(<ProfileForm profile={profile} currencies={currencies} />);

  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await screen.findByRole("alert");
  const input = screen.getByRole("textbox", { name: label });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toBe(message);
  expect(toast.success).not.toHaveBeenCalled();
});

// source: Excel ACC-09 + GEN-02 - an unsupported currency is reported under the currency field
test("a currency error is shown under the currency field", async () => {
  const message = "Preferred currency CHF is not supported";
  const body = { statusCode: 400, error: "x", message, fieldErrors: [{ field: "preferredCurrency", messages: [message] }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  render(<ProfileForm profile={profile} currencies={currencies} />);

  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await screen.findByRole("alert");
  expect(screen.getByRole("combobox", { name: /preferred currency/i }).getAttribute("aria-invalid")).toBe("true");
});
