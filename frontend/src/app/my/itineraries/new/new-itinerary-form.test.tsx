// P-25 New itinerary form (ITN-01 create, ITN-20 Public/Private, GEN-02 field-level messages).
// Only fetch, the router and the toast are faked; browser APIs jsdom lacks are stubbed; the clock is fixed.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { NewItineraryForm } from "./new-itinerary-form";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 23, 12, 0, 0));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.replace.mockReset();
});

// source: Mock Data UPDATED.xlsx Countries.csv (official codes): EG Egypt, AE United Arab Emirates, GB United Kingdom
const countries = [
  { value: "EG", label: "Egypt" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(...replies: Response[]) {
  const fetchMock = vi.fn();
  for (const r of replies) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const titleInput = () => screen.getByRole("textbox", { name: /^title/i });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Create itinerary" }));

async function pickCountry(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /^countries/i }));
  fireEvent.click(await screen.findByRole("option", { name }));
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("option", { name })).toBeNull());
}
async function pickDay(day: RegExp) {
  const trigger = screen.getByRole("button", { name: /^start date/i });
  fireEvent.click(trigger);
  await waitFor(() => {
    const button = screen.queryByRole("button", { name: day });
    if (button) fireEvent.click(button);
    expect(trigger.textContent).not.toContain("Pick a date");
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: day })).toBeNull());
}
async function fillValid() {
  fireEvent.change(titleInput(), { target: { value: "Ten days in Egypt and the UAE" } });
  await pickCountry("Egypt");
  await pickCountry("United Arab Emirates");
  await pickDay(/November 30th, 2026/);
}
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string) as unknown;

// source: Excel ITN-01 "create an itinerary with a required title, one or more countries selected from a
// predefined list and a start date"; openapi POST /api/itineraries CreateItineraryRequest {title, countryCodes, startDate}
test("creating sends POST /api/itineraries with the title, the chosen country codes and the start date", async () => {
  const fetchMock = stubFetch(json(201, { id: "it1", visibility: "private" }));
  render(<NewItineraryForm countries={countries} />);

  await fillValid();
  submit();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/itineraries");
  expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
    title: "Ten days in Egypt and the UAE",
    countryCodes: ["EG", "AE"],
    startDate: "2026-11-30",
  });
});

// source: Excel ITN-01 "It is private by default"; openapi POST /api/itineraries "It is private by default (ITN-20)"
test("Private is chosen by default and a default create sends no visibility change", async () => {
  const fetchMock = stubFetch(json(201, { id: "it1", visibility: "private" }));
  render(<NewItineraryForm countries={countries} />);

  expect(screen.getByRole("radio", { name: "Private" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: "Public" }).getAttribute("aria-checked")).toBe("false");

  await fillValid();
  submit();

  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
});

// source: Excel ITN-20 "set an itinerary's visibility to Public or Private"; PDF 8.8 "PATCH /api/itineraries/:id ITN-01, ITN-20";
// openapi UpdateItineraryRequest.visibility enum [private, public]
test("choosing Public creates the itinerary, then sends PATCH /api/itineraries/{id} with visibility public", async () => {
  const fetchMock = stubFetch(json(201, { id: "it1", visibility: "private" }), json(200, { id: "it1", visibility: "public" }));
  render(<NewItineraryForm countries={countries} />);

  await fillValid();
  fireEvent.click(screen.getByRole("radio", { name: "Public" }));
  submit();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/itineraries");
  expect(fetchMock.mock.calls[1][0]).toBe("/api/itineraries/it1");
  expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PATCH");
  expect(bodyOf(fetchMock.mock.calls[1])).toEqual({ visibility: "public" });
});

// source: Excel ITN-01 "required title"; GEN-02 "field-level validation messages on all forms"
test("an empty title is not sent and the Title field is marked with a message", async () => {
  const fetchMock = stubFetch();
  render(<NewItineraryForm countries={countries} />);

  await pickCountry("Egypt");
  await pickDay(/November 30th, 2026/);
  fireEvent.change(titleInput(), { target: { value: "   " } });
  submit();

  await waitFor(() => expect(titleInput().getAttribute("aria-invalid")).toBe("true"));
  expect(titleInput().getAttribute("aria-describedby")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel ITN-01 "one or more countries"; GEN-02 field-level messages
test("no country chosen is not sent and the Countries field is marked with a message", async () => {
  const fetchMock = stubFetch();
  render(<NewItineraryForm countries={countries} />);

  fireEvent.change(titleInput(), { target: { value: "Trip" } });
  await pickDay(/November 30th, 2026/);
  submit();

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^countries/i }).getAttribute("aria-invalid")).toBe("true"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel ITN-01 "and a start date" (required); GEN-02 field-level messages
test("no start date is not sent and the Start date field is marked with a message", async () => {
  const fetchMock = stubFetch();
  render(<NewItineraryForm countries={countries} />);

  fireEvent.change(titleInput(), { target: { value: "Trip" } });
  await pickCountry("Egypt");
  submit();

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^start date/i }).getAttribute("aria-invalid")).toBe("true"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel ITN-01 "required title (max 100 characters)"; openapi CreateItineraryRequest.title maxLength 100
test("the title input accepts at most 100 characters", () => {
  render(<NewItineraryForm countries={countries} />);
  expect(titleInput().getAttribute("maxlength")).toBe("100");
});

// source: Excel ITN-01 "countries selected from a predefined list"; Mock Data Countries.csv
test("the country list offers exactly the predefined countries given to the form", async () => {
  render(<NewItineraryForm countries={countries} />);
  fireEvent.click(screen.getByRole("button", { name: /^countries/i }));
  const options = await screen.findAllByRole("option");
  expect(options.map((o) => o.textContent?.trim())).toEqual(["Egypt", "United Arab Emirates", "United Kingdom"]);
});

// source: GEN-02 "field-level validation messages on all forms"; openapi Error.fieldErrors [{field, messages}]
// and POST /api/itineraries 400 "Invalid fields or a country not in the list."
test("a backend 400 with fieldErrors marks the named field, shows the backend message and stays on the page", async () => {
  stubFetch(
    json(400, {
      statusCode: 400,
      error: "BAD_REQUEST",
      message: "Invalid fields or a country not in the list.",
      fieldErrors: [{ field: "countryCodes", messages: ["Unknown country code ZZ"] }],
      path: "/api/itineraries",
      timestamp: "2026-11-01T10:00:00.000Z",
    }),
  );
  render(<NewItineraryForm countries={countries} />);

  await fillValid();
  submit();

  expect(await screen.findByText("Invalid fields or a country not in the list.")).toBeTruthy();
  expect(screen.getAllByText("Unknown country code ZZ").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /^countries/i }).getAttribute("aria-invalid")).toBe("true");
  expect(router.replace).not.toHaveBeenCalled();
});
