// FavouriteButton (BON-02 bonus): registered users save/remove a hotel or public itinerary;
// guests see the button and go to login, then come back (team leader decision 4, 24 Nov; ACC-10).
// Only fetch, navigation and the toast are faked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { FavouriteButton } from "./favourite-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.error.mockReset();
  window.history.pushState({}, "", "/");
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const button = () => screen.getByRole("button", { name: "Save to favourites" });

// source: team leader decision 4 (24 Nov) - guests SEE the button; clicking sends them to /login?returnTo=<current page> (ACC-10)
test("a guest sees the button and is sent to login, returning to this page", () => {
  window.history.pushState({}, "", "/hotels/h1?checkIn=2027-03-01");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const navigate = vi.fn();
  render(<FavouriteButton type="hotel" targetId="h1" favouriteId={null} role={null} navigate={navigate} />);

  fireEvent.click(button());

  expect(navigate).toHaveBeenCalledWith("/login?returnTo=%2Fhotels%2Fh1%3FcheckIn%3D2027-03-01");
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel BON-02 - save hotels and public itineraries; openapi POST /api/favourites { type, targetId }
test("a registered user saves the item", async () => {
  const fetchMock = vi.fn().mockResolvedValue(json(201, { id: "f1", type: "itinerary", targetId: "i1" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<FavouriteButton type="itinerary" targetId="i1" favouriteId={null} role="user" navigate={vi.fn()} />);
  expect(button().getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(button());

  await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("true"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/favourites");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: "itinerary", targetId: "i1" });
});

// source: Excel BON-02 + team leader decision 4 - toggle remove; openapi DELETE /api/favourites/{id}
test("saving then clicking again removes it with the favourite's id", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json(201, { id: "f7", type: "hotel", targetId: "h1" }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<FavouriteButton type="hotel" targetId="h1" favouriteId={null} role="user" navigate={vi.fn()} />);

  fireEvent.click(button());
  await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("true"));
  fireEvent.click(button());

  await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("false"));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/favourites/f7");
  expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
});

// source: openapi DELETE /api/favourites/{id} - an item already saved (the page passes its favourite id)
test("an item already saved starts pressed and removes with the given id", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<FavouriteButton type="hotel" targetId="h1" favouriteId="f3" role="user" navigate={vi.fn()} />);
  expect(button().getAttribute("aria-pressed")).toBe("true");

  fireEvent.click(button());

  await waitFor(() => expect(button().getAttribute("aria-pressed")).toBe("false"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/favourites/f3");
});

// source: Excel BON-02 actor = Registered User (the backend refuses other roles)
test("admins and moderators do not get the button", () => {
  const { container } = render(<FavouriteButton type="hotel" targetId="h1" favouriteId={null} role="admin" navigate={vi.fn()} />);
  expect(container.innerHTML).toBe("");
});

// source: Excel GEN-16 - error feedback (backend 404 "Itinerary not found, private or hidden.")
test("a failure shows the backend's message and keeps the state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { statusCode: 404, error: "NOT_FOUND", message: "Itinerary not found, private or hidden." })));
  render(<FavouriteButton type="itinerary" targetId="i1" favouriteId={null} role="user" navigate={vi.fn()} />);

  fireEvent.click(button());

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Itinerary not found, private or hidden."));
  expect(button().getAttribute("aria-pressed")).toBe("false");
});
