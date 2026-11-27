// DayCard "Delete day" (ITN-07). Faked: fetch (backend), the router and the toast.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { DayCard } from "./day-card";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// source: Mock Data UPDATED Cities (cairo); openapi ItineraryDay
const day = { id: "d1", number: 1, date: "2027-03-01", cityId: "cairo", notes: "" };

test("confirming Delete day sends DELETE with the confirmation flag the backend requires", async () => {
  // source: Excel UPDATED ITN-07 "delete a day after confirmation"; PDF section 8 DELETE /api/itineraries/:id/days/:dayId (ITN-07)
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <DayCard day={day} itineraryId="it1" cities={[{ value: "cairo", label: "Cairo" }]} currencies={[]}
      days={[{ value: "d1", label: "Day 1" }]} transport={[]} bookings={[]} moving={false} onMove={() => {}} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete day" }));
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete day" }));

  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");
  expect(deletes.map(([url]) => String(url))).toEqual(["/api/itineraries/it1/days/d1?confirm=true"]);
});
