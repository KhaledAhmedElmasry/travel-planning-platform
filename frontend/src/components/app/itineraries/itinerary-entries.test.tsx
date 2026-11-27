// P-26 itinerary editor entries: activities (ITN-10), budget entries (ITN-14), transport costs (ITN-16).
// Faked: fetch (backend), next/navigation and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ActivityCard } from "./activity-card";
import { BudgetRow } from "./budget-row";
import { TransportRow } from "./transport-row";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const writes = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }));
async function choose(label: RegExp, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
async function optionsOf(label: RegExp) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  return (await screen.findAllByRole("option")).map((option) => option.textContent);
}
async function openForm(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog");
}
async function save(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
}
async function confirmDelete(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
}

// source: Mock Data UPDATED Countries.csv currencies (EGP, USD); Cities.csv (cairo, dubai)
const currencies = [{ value: "EGP", label: "EGP" }, { value: "USD", label: "USD" }];
const cities = [{ value: "cairo", label: "Cairo" }, { value: "dubai", label: "Dubai" }];
const dayPath = "/api/itineraries/it1/days/d1";

// ---- ITN-10 activities ----

test("adding an activity with time and cost sends name, description, time, cost and currency", async () => {
  // source: Excel UPDATED ITN-10 "name, description, optional time and optional cost"; PDF 8.8 POST /api/itineraries/:id/days/:dayId/activities;
  // openapi CreateActivityRequest (time HH:mm, cost >= 0, currency "Required when cost is given")
  const fetchMock = stubFetch();
  render(<ActivityCard dayPath={dayPath} currencies={currencies} />);
  const dialog = await openForm("Add activity");
  fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Visit the Giza Pyramids" } });
  fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: "Guided tour of the pyramids and the Sphinx." } });
  fireEvent.change(within(dialog).getByLabelText(/^Time/), { target: { value: "09:00" } });
  fireEvent.change(within(dialog).getByLabelText(/^Cost/), { target: { value: "25.5" } });
  await choose(/^Currency/, "USD");
  await save(dialog);

  expect(writes(fetchMock)).toEqual([{
    url: "/api/itineraries/it1/days/d1/activities", method: "POST",
    body: { name: "Visit the Giza Pyramids", description: "Guided tour of the pyramids and the Sphinx.", time: "09:00", cost: 25.5, currency: "USD" },
  }]);
});

test("an activity can be added without the optional time and cost", async () => {
  // source: Excel UPDATED ITN-10 "optional time and optional cost"; openapi CreateActivityRequest required [name, description]
  const fetchMock = stubFetch();
  render(<ActivityCard dayPath={dayPath} currencies={currencies} />);
  const dialog = await openForm("Add activity");
  fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Khan el-Khalili" } });
  fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: "Walk the bazaar." } });
  await save(dialog);

  expect(writes(fetchMock)).toEqual([{
    url: "/api/itineraries/it1/days/d1/activities", method: "POST", body: { name: "Khan el-Khalili", description: "Walk the bazaar." },
  }]);
});

// source: openapi Activity (id, name, description, time, cost, currency, images)
const activity = { id: "a1", name: "Visit the Giza Pyramids", description: "Guided tour.", time: "09:00", cost: 25.5, currency: "USD", images: [] };

test("editing an activity sends PATCH to the activity", async () => {
  // source: Excel UPDATED ITN-10 "edit ... activities"; PDF 8.8 PATCH /api/activities/:id (ITN-10)
  const fetchMock = stubFetch();
  render(<ActivityCard dayPath={dayPath} activity={activity} currencies={currencies} />);
  const dialog = await openForm("Edit activity");
  fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Pyramids at sunrise" } });
  await save(dialog);

  const sent = writes(fetchMock);
  expect(sent.map(({ url, method }) => [url, method])).toEqual([["/api/activities/a1", "PATCH"]]);
  expect(sent[0].body.name).toBe("Pyramids at sunrise");
});

test("deleting an activity sends DELETE to the activity after confirmation", async () => {
  // source: Excel UPDATED ITN-10 "delete activities"; PDF 8.8 DELETE /api/activities/:id (ITN-10)
  const fetchMock = stubFetch();
  render(<ActivityCard dayPath={dayPath} activity={activity} currencies={currencies} />);
  await confirmDelete("Delete activity");
  expect(writes(fetchMock).map(({ url, method }) => [url, method])).toEqual([["/api/activities/a1", "DELETE"]]);
});

// ---- ITN-14 budget entries ----

test("budget categories are food, accommodation, in-city transport and activities", async () => {
  // source: Excel UPDATED ITN-14 "across food, accommodation, in-city transport and activities"; openapi BudgetCategory enum
  stubFetch();
  render(<BudgetRow dayPath={dayPath} currencies={currencies} />);
  await openForm("Add budget entry");
  expect(await optionsOf(/^Category/)).toEqual(["Food", "Accommodation", "In-city transport", "Activities"]);
});

test("adding a budget entry sends category, amount, currency and description", async () => {
  // source: Excel UPDATED ITN-14 "budget entries for each day ... in a selected currency"; PDF 8.8 POST /api/itineraries/:id/days/:dayId/budgets;
  // openapi CreateBudgetEntryRequest {category, amount, currency, description} (category value in_city_transport)
  const fetchMock = stubFetch();
  render(<BudgetRow dayPath={dayPath} currencies={currencies} />);
  const dialog = await openForm("Add budget entry");
  await choose(/^Category/, "In-city transport");
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: "40" } });
  await choose(/^Currency/, "EGP");
  fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: "Metro tickets" } });
  await save(dialog);

  expect(writes(fetchMock)).toEqual([{
    url: "/api/itineraries/it1/days/d1/budgets", method: "POST",
    body: { category: "in_city_transport", amount: 40, currency: "EGP", description: "Metro tickets" },
  }]);
});

test("the budget amount field does not accept negative values", async () => {
  // source: Excel UPDATED ITN-14 "non-negative budget entries"
  stubFetch();
  render(<BudgetRow dayPath={dayPath} currencies={currencies} />);
  const dialog = await openForm("Add budget entry");
  expect((within(dialog).getByLabelText(/^Amount/) as HTMLInputElement).min).toBe("0");
});

// source: openapi BudgetEntry (id, category, amount, currency, description)
const budget = { id: "b1", category: "food", amount: 100, currency: "EGP", description: "Dinner" };

test("editing and deleting a budget entry use its own path", async () => {
  // source: Excel UPDATED ITN-14 "add, edit and delete"; PDF 8.8 PATCH /api/budgets/:id, DELETE /api/budgets/:id (ITN-14)
  const fetchMock = stubFetch();
  render(<BudgetRow dayPath={dayPath} entry={budget} currencies={currencies} />);
  const dialog = await openForm("Edit budget entry");
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: "120" } });
  await save(dialog);
  router.refresh.mockClear();
  await confirmDelete("Delete budget entry");

  const sent = writes(fetchMock);
  expect(sent.map(({ url, method }) => [url, method])).toEqual([["/api/budgets/b1", "PATCH"], ["/api/budgets/b1", "DELETE"]]);
  expect(sent[0].body.amount).toBe(120);
});

// ---- ITN-16 transport costs ----

const days = [{ value: "d1", label: "Day 1" }, { value: "d2", label: "Day 2" }];

test("transport modes are flight, train, bus, car, ferry and other", async () => {
  // source: openapi TransportMode enum [flight, train, bus, car, ferry, other] (Excel ITN-16 names "mode" only)
  stubFetch();
  render(<TransportRow itineraryPath="/api/itineraries/it1" dayId="d1" days={days} cities={cities} currencies={currencies} />);
  await openForm("Add transport cost");
  expect((await optionsOf(/^Mode/)).map((label) => label?.toLowerCase())).toEqual(["flight", "train", "bus", "car", "ferry", "other"]);
});

test("adding a transport cost sends mode, from-city, to-city, amount, currency and day", async () => {
  // source: Excel UPDATED ITN-16 "transport cost entry (mode, from-city, to-city, amount, currency, day)";
  // PDF 8.8 POST /api/itineraries/:id/transport-costs (ITN-16); openapi field names dayId, mode, fromCityId, toCityId, amount, currency
  const fetchMock = stubFetch();
  render(<TransportRow itineraryPath="/api/itineraries/it1" dayId="d2" days={days} cities={cities} currencies={currencies} />);
  const dialog = await openForm("Add transport cost");
  await choose(/^Mode/, "Flight");
  await choose(/^From city/, "Cairo");
  await choose(/^To city/, "Dubai");
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: "300" } });
  await choose(/^Currency/, "USD");
  await save(dialog);

  expect(writes(fetchMock)).toEqual([{
    url: "/api/itineraries/it1/transport-costs", method: "POST",
    body: { dayId: "d2", mode: "flight", fromCityId: "cairo", toCityId: "dubai", amount: 300, currency: "USD" },
  }]);
});

// source: openapi TransportCost (id, dayId, mode, fromCityId, toCityId, amount, currency)
const transport = { id: "t1", dayId: "d1", mode: "flight", fromCityId: "cairo", toCityId: "dubai", amount: 300, currency: "USD" };

test("a transport cost shows its cities and is edited and deleted on its own path", async () => {
  // source: Excel UPDATED ITN-16 "add, edit and delete a transport cost entry"; PDF 8.8 PATCH /api/transport-costs/:id, DELETE /api/transport-costs/:id
  const fetchMock = stubFetch();
  render(<TransportRow itineraryPath="/api/itineraries/it1" dayId="d1" entry={transport} days={days} cities={cities} currencies={currencies} />);
  expect(screen.getByText(/Cairo to Dubai/)).toBeTruthy();
  const dialog = await openForm("Edit transport cost");
  fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: "280" } });
  await save(dialog);
  router.refresh.mockClear();
  await confirmDelete("Delete transport cost");

  const sent = writes(fetchMock);
  expect(sent.map(({ url, method }) => [url, method])).toEqual([["/api/transport-costs/t1", "PATCH"], ["/api/transport-costs/t1", "DELETE"]]);
  expect(sent[0].body.amount).toBe(280);
});
