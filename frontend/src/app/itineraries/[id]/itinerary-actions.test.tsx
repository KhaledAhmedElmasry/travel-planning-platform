// P-28 buttons (ITN-21 Clone, BON-02 Save, GEN-09 Report). The page is cached for everyone (ISR), so
// this Client Component asks who is viewing (GET /api/auth/me) in the browser.
// Only fetch, navigation and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ItineraryActions } from "./itinerary-actions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  window.history.pushState({}, "", "/");
});

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Fake backend: answers by "METHOD path". */
function backend(routes: Record<string, Response | (() => Response)>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const r = routes[key];
    if (!r) throw new Error(`unexpected ${key}`);
    return typeof r === "function" ? r() : r.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const me = (role: string) => json(200, { id: "u1", name: "Mona", email: "m@x.io", role });
const ID = "665f1c2a9b1e8a00123400a1";
const FAV = `GET /api/favourites?type=itinerary&targetId=${ID}`;

// source: team leader decision 24 Nov - P-28 Clone "A guest goes to /login?returnTo=<this page> first" (ACC-10)
test("a guest sees Clone and goes to login, coming back to this page", async () => {
  window.history.pushState({}, "", `/itineraries/${ID}`);
  const fetchMock = backend({ "GET /api/auth/me": () => json(401, { message: "Unauthorized" }), "POST /api/auth/refresh": () => json(401) });
  const navigate = vi.fn();
  render(<ItineraryActions itineraryId={ID} navigate={navigate} />);

  fireEvent.click(await screen.findByRole("button", { name: "Clone" }));

  expect(navigate).toHaveBeenCalledWith(`/login?returnTo=%2Fitineraries%2F${ID}`);
  expect(fetchMock.mock.calls.map((c) => c[0])).not.toContain(FAV.slice(4));
});

// source: team leader decision 24 Nov - P-28 Clone: toast "Copied to My itineraries", go to /my/itineraries/{newId}; openapi POST /api/itineraries/{id}/clone
test("a registered user clones: toast, then the new private copy", async () => {
  const fetchMock = backend({
    "GET /api/auth/me": me("user"),
    [FAV]: json(200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }),
    [`POST /api/itineraries/${ID}/clone`]: json(201, { id: "new9" }),
  });
  const navigate = vi.fn();
  render(<ItineraryActions itineraryId={ID} navigate={navigate} />);

  fireEvent.click(await screen.findByRole("button", { name: "Clone" }));

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/my/itineraries/new9"));
  expect(toast.success).toHaveBeenCalledWith("Copied to My itineraries");
  expect(fetchMock).toHaveBeenCalledWith(`/api/itineraries/${ID}/clone`, expect.objectContaining({ method: "POST" }));
});

// source: openapi POST /api/itineraries/{id}/clone 404 "Itinerary not found or not public."
test("a failed clone shows the backend message and stays on the page", async () => {
  backend({
    "GET /api/auth/me": me("user"),
    [FAV]: json(200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }),
    [`POST /api/itineraries/${ID}/clone`]: json(404, { statusCode: 404, error: "NOT_FOUND", message: "Itinerary not found or not public." }),
  });
  const navigate = vi.fn();
  render(<ItineraryActions itineraryId={ID} navigate={navigate} />);

  fireEvent.click(await screen.findByRole("button", { name: "Clone" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Itinerary not found or not public."));
  expect(navigate).not.toHaveBeenCalled();
});

// source: task brief - FavouriteButton saved state via GET /api/favourites?type=itinerary&targetId= (BON-02); openapi listFavourites
test("a registered user sees whether the itinerary is already saved", async () => {
  backend({
    "GET /api/auth/me": me("user"),
    [FAV]: json(200, { items: [{ id: "f1", type: "itinerary", targetId: ID }], page: 1, pageSize: 10, total: 1, totalPages: 1 }),
  });
  render(<ItineraryActions itineraryId={ID} navigate={vi.fn()} />);

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save to favourites" }).getAttribute("aria-pressed")).toBe("true"),
  );
});

// source: team leader decision 24 Nov - "if [the backend] refuses them, don't show the button" (clone is @Roles(Role.User)); BON-02 registered users
test("an admin gets no Clone and no Save button, but can still report", async () => {
  backend({ "GET /api/auth/me": me("admin") });
  render(<ItineraryActions itineraryId={ID} navigate={vi.fn()} />);

  expect(await screen.findByRole("button", { name: "Report" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Clone" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save to favourites" })).toBeNull();
});

// source: Excel GEN-10 - "an admin can hide or delete any post, comment, review or itinerary directly"
test("an admin gets Hide and Delete for this itinerary", async () => {
  backend({ "GET /api/auth/me": me("admin") });
  render(<ItineraryActions itineraryId={ID} navigate={vi.fn()} />);

  expect(await screen.findByRole("button", { name: "Hide" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
});

// source: Excel GEN-10 - hidden content stays visible to admins, who can unhide it
test("on a hidden itinerary an admin gets Unhide", async () => {
  backend({ "GET /api/auth/me": me("admin") });
  render(<ItineraryActions itineraryId={ID} hidden navigate={vi.fn()} />);

  expect(await screen.findByRole("button", { name: "Unhide" })).toBeTruthy();
});

test("registered users and guests get no admin buttons", async () => {
  backend({ "GET /api/auth/me": me("user"), [FAV]: json(200, { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }) });
  render(<ItineraryActions itineraryId={ID} navigate={vi.fn()} />);

  await screen.findByRole("button", { name: "Clone" });
  expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
});
