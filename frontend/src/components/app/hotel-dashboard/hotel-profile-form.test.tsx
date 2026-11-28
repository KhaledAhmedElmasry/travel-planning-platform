// P-42 hotel profile form (HTL-01, GEN-08, GEN-12, GEN-02, GEN-14). Only fetch, the router, the toast and the
// browser's blob URLs are faked. Multipart field names are the PATCH /api/hotels/{id} contract (openapi HotelUpdateForm).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { HotelProfileForm, type City, type Country, type HotelProfile } from "./hotel-profile-form";

// jsdom lacks these browser APIs; the Radix select and the photo previews need them (not our code).
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
  router.refresh.mockReset();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// source: Mock Data.xlsx Countries.csv / Cities.csv (official ids, GEN-12)
const countries: Country[] = [
  { code: "EG", name: "Egypt" },
  { code: "AE", name: "United Arab Emirates" },
];
const egyptCities: City[] = [{ cityId: "cairo", name: "Cairo" }];
const uaeCities: City[] = [{ cityId: "dubai", name: "Dubai" }];

// source: Excel HTL-01 - the profile fields: name, address, city and country, description, photos, star class, amenities
const hotel: HotelProfile = {
  id: "665f1c2a9b1e8a00123400a1",
  name: "Nile View Hotel",
  address: "12 Corniche St",
  cityId: "cairo",
  countryCode: "EG",
  description: "A quiet hotel on the Nile.",
  starRating: 3,
  photos: [
    { id: "p1", url: "/uploads/hotels/p1.jpg" },
    { id: "p2", url: "/uploads/hotels/p2.jpg" },
  ],
  amenities: ["Wi-Fi", "Pool"],
};

function renderForm(overrides: Partial<HotelProfile> = {}) {
  return render(<HotelProfileForm hotel={{ ...hotel, ...overrides }} countries={countries} initialCities={egyptCities} />);
}

/** Saves and returns the FormData of the PATCH. */
async function saveAndGetBody(fetchMock: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [, init] = fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/hotels/"))!;
  return init.body as FormData;
}

function okFetch() {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, hotel));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

// source: Excel HTL-01 - the moderator edits the hotel's name, address, city and country, description, star class, amenities
test("the form starts with the hotel's saved profile", () => {
  renderForm();

  expect((screen.getByRole("textbox", { name: /hotel name/i }) as HTMLInputElement).value).toBe("Nile View Hotel");
  expect((screen.getByRole("textbox", { name: /address/i }) as HTMLInputElement).value).toBe("12 Corniche St");
  expect(screen.getByRole("combobox", { name: /country/i }).textContent).toContain("Egypt");
  expect(screen.getByRole("combobox", { name: /city/i }).textContent).toContain("Cairo");
  expect((screen.getByRole("textbox", { name: /description/i }) as HTMLTextAreaElement).value).toBe("A quiet hotel on the Nile.");
  expect(within(screen.getByRole("group", { name: /star/i })).getByText("3")).toBeDefined();
  expect(screen.getByText("Wi-Fi")).toBeDefined();
  expect(screen.getByText("Pool")).toBeDefined();
});

// source: Excel HTL-01 photos + GEN-08 "served by URL" - the hotel's existing photos are shown
test("the hotel's existing photos are shown", () => {
  const { container } = renderForm();

  const sources = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
  expect(sources).toEqual(["/uploads/hotels/p1.jpg", "/uploads/hotels/p2.jpg"]);
});

// source: PDF 8.5 PATCH /api/hotels/:id (HTL-01) - editing the name saves it on the hotel
test("saving sends PATCH /api/hotels/{id} with the edited name", async () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.change(screen.getByRole("textbox", { name: /hotel name/i }), { target: { value: "Nile Palace" } });
  const body = await saveAndGetBody(fetchMock);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/hotels/665f1c2a9b1e8a00123400a1");
  expect(init.method).toBe("PATCH");
  expect(body.get("name")).toBe("Nile Palace");
});

// source: Excel HTL-01 - edit address and description
test("edited address and description are saved", async () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.change(screen.getByRole("textbox", { name: /address/i }), { target: { value: "1 Tahrir Sq" } });
  fireEvent.change(screen.getByRole("textbox", { name: /description/i }), { target: { value: "Close to the museum." } });
  const body = await saveAndGetBody(fetchMock);

  expect(body.get("address")).toBe("1 Tahrir Sq");
  expect(body.get("description")).toBe("Close to the museum.");
});

// source: Excel HTL-01 - edit the star class
test("raising the star class by one saves the new class", async () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.click(within(screen.getByRole("group", { name: /star/i })).getByRole("button", { name: /more/i }));
  const body = await saveAndGetBody(fetchMock);

  expect(body.get("starRating")).toBe("4");
});

// source: Excel HTL-01 - edit the amenities (add one)
test("an added amenity is saved together with the existing ones", async () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.change(screen.getByRole("textbox", { name: /amenities/i }), { target: { value: "Gym" } });
  fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
  const body = await saveAndGetBody(fetchMock);

  expect(body.getAll("amenities")).toEqual(["Wi-Fi", "Pool", "Gym"]);
});

// source: Excel HTL-01 - edit the amenities (remove one)
test("a removed amenity is not saved", async () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.click(screen.getByRole("button", { name: /remove pool/i }));
  const body = await saveAndGetBody(fetchMock);

  expect(body.getAll("amenities")).toEqual(["Wi-Fi"]);
});

// source: Excel HTL-01 "city and country" + GEN-12 seeded cities (Mock Data: dubai belongs to AE)
test("choosing another country lists that country's cities", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: uaeCities, page: 1, pageSize: 10, total: 1, totalPages: 1 }));
  vi.stubGlobal("fetch", fetchMock);
  renderForm();

  fireEvent.keyDown(screen.getByRole("combobox", { name: /country/i }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "United Arab Emirates" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/cities\?country=AE(&|$)/);

  const city = screen.getByRole("combobox", { name: /city/i });
  await waitFor(() => expect(city.hasAttribute("disabled")).toBe(false));
  fireEvent.keyDown(city, { key: "Enter" });
  expect(await screen.findByRole("option", { name: "Dubai" })).toBeDefined();
  expect(screen.queryByRole("option", { name: "Cairo" })).toBeNull();
});

// source: Excel HTL-01 "city and country" - the new country and a city of it are saved together
test("the new country and its chosen city are saved", async () => {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url.startsWith("/api/cities")
        ? jsonResponse(200, { items: uaeCities, page: 1, pageSize: 10, total: 1, totalPages: 1 })
        : jsonResponse(200, hotel),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  renderForm();

  fireEvent.keyDown(screen.getByRole("combobox", { name: /country/i }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "United Arab Emirates" }));
  const city = screen.getByRole("combobox", { name: /city/i });
  await waitFor(() => expect(city.hasAttribute("disabled")).toBe(false));
  fireEvent.keyDown(city, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "Dubai" }));
  const body = await saveAndGetBody(fetchMock);

  expect(body.get("countryCode")).toBe("AE");
  expect(body.get("cityId")).toBe("dubai");
});

// source: Excel HTL-01 photos + GEN-08 JPG accepted - a new photo is uploaded with the save
test("a new JPG photo is sent with the save", async () => {
  const fetchMock = okFetch();
  const { container } = renderForm();
  const photo = new File(["jpg-bytes"], "lobby.jpg", { type: "image/jpeg" });

  fireEvent.change(fileInput(container), { target: { files: [photo] } });
  const body = await saveAndGetBody(fetchMock);

  expect(body.getAll("photos")).toEqual([photo]);
});

// source: Excel HTL-01 - edit photos (remove one)
test("a removed photo's id is sent with the save", async () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.click(screen.getAllByRole("button", { name: /remove photo/i })[0]);
  const body = await saveAndGetBody(fetchMock);

  expect(body.getAll("removePhotoIds")).toEqual(["p1"]);
});

// source: Excel GEN-08 - only JPG or PNG; other uploads are rejected with an error
test("a GIF is rejected with an error and not sent", async () => {
  const fetchMock = okFetch();
  const { container } = renderForm();

  fireEvent.change(fileInput(container), { target: { files: [new File(["gif"], "anim.gif", { type: "image/gif" })] } });

  expect(screen.getByRole("alert").textContent).toMatch(/anim\.gif/);
  const body = await saveAndGetBody(fetchMock);
  expect(body.getAll("photos")).toEqual([]);
});

// source: Excel GEN-08 - up to 5 MB each; larger uploads are rejected with an error
test("a photo larger than 5 MB is rejected with an error and not sent", async () => {
  const fetchMock = okFetch();
  const { container } = renderForm();
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });

  fireEvent.change(fileInput(container), { target: { files: [big] } });

  expect(screen.getByRole("alert").textContent).toMatch(/big\.png/);
  const body = await saveAndGetBody(fetchMock);
  expect(body.getAll("photos")).toEqual([]);
});

// source: Excel GEN-08 - up to 5 images per hotel
test("a hotel with 5 photos cannot add a sixth", () => {
  const five = ["a", "b", "c", "d", "e"].map((id) => ({ id, url: `/uploads/hotels/${id}.jpg` }));
  renderForm({ photos: five });

  // the add button carries the visible text "Add photo" (its accessible name is the field label)
  expect(screen.queryByText(/add photo/i)).toBeNull();
  expect(screen.getByText(/5 of 5/)).toBeDefined();
});

// source: Excel GEN-08 - up to 5 images per hotel; extra files are rejected with an error
test("choosing more photos than the 5 allowed sends only up to 5 in total", async () => {
  const fetchMock = okFetch();
  const { container } = renderForm();
  const files = ["1", "2", "3", "4"].map((n) => new File(["x"], `room${n}.png`, { type: "image/png" }));

  fireEvent.change(fileInput(container), { target: { files } });

  expect(screen.getByRole("alert")).toBeDefined();
  const body = await saveAndGetBody(fetchMock);
  expect(body.getAll("photos")).toHaveLength(3);
});

// source: Excel GEN-02 - field-level validation messages; an emptied hotel name is not saved
test("an empty hotel name is flagged on that field and nothing is sent", async () => {
  const fetchMock = okFetch();
  renderForm();

  const name = screen.getByRole("textbox", { name: /hotel name/i });
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() => expect(name.getAttribute("aria-invalid")).toBe("true"));
  expect(document.getElementById(name.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).not.toBe("");
  expect(fetchMock).not.toHaveBeenCalled();
});

// source: Excel GEN-02 - a backend field error is shown under its field
test("a backend error on the address is shown under the address field", async () => {
  const message = "address must be shorter than or equal to 200 characters";
  const body = { statusCode: 400, error: "BAD_REQUEST", message: "Validation failed", fieldErrors: [{ field: "address", messages: [message] }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, body)));
  renderForm();

  fireEvent.click(screen.getByRole("button", { name: /save/i }));

  await screen.findByRole("alert");
  const address = screen.getByRole("textbox", { name: /address/i });
  expect(address.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(address.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toBe(message);
  expect(toast.success).not.toHaveBeenCalled();
});

// source: Excel GEN-14 - users can cancel actions without losing data: unsaved edits go back to the saved profile
test("discarding unsaved edits restores the saved profile without saving", () => {
  const fetchMock = okFetch();
  renderForm();

  fireEvent.change(screen.getByRole("textbox", { name: /hotel name/i }), { target: { value: "Changed" } });
  fireEvent.click(screen.getByRole("button", { name: /remove pool/i }));
  fireEvent.click(screen.getByRole("button", { name: /discard|cancel/i }));

  expect((screen.getByRole("textbox", { name: /hotel name/i }) as HTMLInputElement).value).toBe("Nile View Hotel");
  expect(screen.getByText("Pool")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});
