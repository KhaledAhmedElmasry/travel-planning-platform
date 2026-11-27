// P-26 itinerary editor, itinerary fields: edit (ITN-01), visibility (ITN-20), delete after confirmation (ITN-01).
// Faked: fetch (backend), next/navigation and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ItineraryActions } from "./itinerary-actions";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// source: openapi Itinerary (id, title, countryCodes, startDate, visibility); Mock Data UPDATED Countries.csv (EG Egypt)
const itinerary = { id: "it1", title: "Cairo week", countryCodes: ["EG"], startDate: "2027-03-01", visibility: "private" as const };
const countries = [{ value: "EG", label: "Egypt" }];

function stubFetch(answer: () => Response) {
  const fetchMock = vi.fn<typeof fetch>(async () => answer());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

test("the title field allows at most 100 characters", () => {
  // source: Excel UPDATED ITN-01 "a required title (max 100 characters)"
  render(<ItineraryActions itinerary={itinerary} countries={countries} />);
  expect((screen.getByLabelText(/^Title/) as HTMLInputElement).maxLength).toBe(100);
});

test("an empty title is not saved", async () => {
  // source: Excel UPDATED ITN-01 "a required title"
  const fetchMock = stubFetch(() => json(itinerary));
  render(<ItineraryActions itinerary={itinerary} countries={countries} />);
  fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Save itinerary" }));
  await screen.findAllByText("Enter a title.");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("setting visibility to Public saves it with PATCH on the itinerary", async () => {
  // source: Excel UPDATED ITN-20 "set an itinerary's visibility to Public or Private"; PDF 8.8 PATCH /api/itineraries/:id (ITN-01, ITN-20);
  // openapi ItineraryVisibility enum [private, public]
  const fetchMock = stubFetch(() => json({ ...itinerary, title: "Cairo and Giza", visibility: "public" }));
  render(<ItineraryActions itinerary={itinerary} countries={countries} />);
  fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Cairo and Giza" } });
  fireEvent.keyDown(screen.getByRole("combobox", { name: /^Visibility/ }), { key: "Enter" });
  const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
  expect(options).toEqual(["Private", "Public"]);
  fireEvent.click(screen.getByRole("option", { name: "Public" }));
  fireEvent.click(screen.getByRole("button", { name: "Save itinerary" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe("/api/itineraries/it1");
  expect(init?.method).toBe("PATCH");
  expect(JSON.parse(String(init?.body))).toMatchObject({ title: "Cairo and Giza", visibility: "public", countryCodes: ["EG"], startDate: "2027-03-01" });
});

test("the itinerary is deleted only after confirmation", async () => {
  // source: Excel UPDATED ITN-01 "delete it after confirmation"; PDF 8.8 DELETE /api/itineraries/:id (ITN-01)
  const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
  render(<ItineraryActions itinerary={itinerary} countries={countries} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete itinerary" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete itinerary" }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/my/itineraries"));
  expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([["/api/itineraries/it1", "DELETE"]]);
});
