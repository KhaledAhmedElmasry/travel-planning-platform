// ExportPdfButton (Bonus ITN-28 "export or print an itinerary as PDF"; spec P-26 "Export PDF"
// button). Faked: fetch (backend), the toast, object URLs and window.open (browser APIs jsdom lacks).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ExportPdfButton } from "./export-pdf-button";

const createObjectURL = vi.fn(() => "blob:pdf-1");
const revokeObjectURL = vi.fn();
const clicked: { href: string; download: string }[] = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.getAttribute("href") ?? "", download: this.download });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  clicked.length = 0;
  toast.success.mockReset();
  toast.error.mockReset();
});

// source: openapi GET /api/itineraries/{id}/pdf - attachment; filename="itinerary-<title>.pdf"
const pdf = () =>
  new Response("%PDF-1.4", {
    status: 200,
    headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="itinerary-Cairo-trip.pdf"' },
  });
const notFound = "Itinerary not found, or it belongs to another user.";
const error404 = () =>
  new Response(JSON.stringify({ statusCode: 404, error: "NOT_FOUND", message: notFound }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });

test("Export PDF downloads the itinerary's PDF with the backend's file name", async () => {
  const fetchMock = vi.fn().mockResolvedValue(pdf());
  vi.stubGlobal("fetch", fetchMock);
  render(<ExportPdfButton itineraryId="i1" />);

  fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("PDF downloaded"));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/itineraries/i1/pdf");
  expect(clicked).toEqual([{ href: "blob:pdf-1", download: "itinerary-Cairo-trip.pdf" }]);
  vi.runAllTimers();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:pdf-1");
});

// source: GEN-16 - loading feedback on every action
test("shows a spinner on the button while the PDF is made", async () => {
  let answer!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
  render(<ExportPdfButton itineraryId="i1" />);

  fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Export PDF" }).getAttribute("aria-busy")).toBe("true"));
  answer(pdf());
  await waitFor(() => expect(screen.getByRole("button", { name: "Export PDF" }).getAttribute("aria-busy")).toBeNull());
});

// source: Excel ITN-28 "export or print"; team leader decision 24 Nov - "Open / Print" opens it in a new tab
test("Open / Print opens the PDF in a new browser tab", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pdf()));
  const tab = { location: { href: "" }, close: vi.fn() };
  const openMock = vi.fn(() => tab);
  vi.stubGlobal("open", openMock);
  render(<ExportPdfButton itineraryId="i1" />);

  fireEvent.click(screen.getByRole("button", { name: "Open / Print" }));

  await waitFor(() => expect(tab.location.href).toBe("blob:pdf-1"));
  expect(openMock).toHaveBeenCalledWith("", "_blank");
  expect(clicked).toEqual([]);
  expect(toast.error).not.toHaveBeenCalled();
});

test("Open / Print tells the user when the browser blocks the new tab", async () => {
  const fetchMock = vi.fn().mockResolvedValue(pdf());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("open", vi.fn(() => null));
  render(<ExportPdfButton itineraryId="i1" />);

  fireEvent.click(screen.getByRole("button", { name: "Open / Print" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Allow pop-ups for this site to open the PDF."));
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: openapi 404 "Itinerary not found, or it belongs to another user."
test("shows the backend's message when the PDF cannot be made, and downloads nothing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(error404()));
  render(<ExportPdfButton itineraryId="i1" />);

  fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(notFound));
  expect(clicked).toEqual([]);
  expect(toast.success).not.toHaveBeenCalled();
});

test("Open / Print closes the empty tab when the PDF cannot be made", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(error404()));
  const tab = { location: { href: "" }, close: vi.fn() };
  vi.stubGlobal("open", vi.fn(() => tab));
  render(<ExportPdfButton itineraryId="i1" />);

  fireEvent.click(screen.getByRole("button", { name: "Open / Print" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(notFound));
  expect(tab.close).toHaveBeenCalled();
});
