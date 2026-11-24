// FilterPanel (FLT-15, HTL-12, ITN-21). Team leader (23 Nov): Apply button, whole amounts in the
// platform currency sent as cents, min > max shows "Max price must be at least the min price"
// (days: "Max days must be at least the min days") under Max and nothing is applied.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FilterPanel } from "./filter-panel";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByRole("spinbutton", { name: label }), { target: { value } });
const apply = () => fireEvent.click(screen.getByRole("button", { name: "Apply" }));
async function choose(label: RegExp, option: RegExp) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
const errorUnder = (label: RegExp) => {
  const input = screen.getByRole("spinbutton", { name: label });
  return document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0])?.textContent;
};

// source: Excel FLT-15 inclusive min and max price; openapi minPrice/maxPrice in cents; team leader: whole amounts
test("flights: the price range is sent in cents", () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="flights" currency="USD" onApply={onApply} />);

  type(/^min price/i, "150");
  type(/^max price/i, "400");
  apply();

  expect(onApply).toHaveBeenCalledWith({ minPrice: 15000, maxPrice: 40000 });
});

// source: Excel FLT-15 "show an error if min > max"; team leader (23 Nov) the text
test("min price above max price shows the error under Max and applies nothing", () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="flights" currency="USD" onApply={onApply} />);

  type(/^min price/i, "500");
  type(/^max price/i, "400");
  apply();

  expect(errorUnder(/^max price/i)).toBe("Max price must be at least the min price");
  expect(onApply).not.toHaveBeenCalled();
});

// source: Excel FLT-15 "inclusive" - min equal to max is allowed
test("min price equal to max price is allowed", () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="flights" currency="USD" onApply={onApply} />);

  type(/^min price/i, "400");
  type(/^max price/i, "400");
  apply();

  expect(onApply).toHaveBeenCalledWith({ minPrice: 40000, maxPrice: 40000 });
});

// source: FLT-15 / HTL-12 - empty fields mean no filter
test("empty fields send no filter", () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="flights" currency="USD" onApply={onApply} />);

  apply();

  expect(onApply).toHaveBeenCalledWith({});
});

// source: Excel HTL-12 - price per night range and minimum average rating 1-5
test("hotels: price per night and minimum rating", async () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="hotels" currency="USD" onApply={onApply} />);

  type(/^min price/i, "50");
  await choose(/^minimum rating/i, /^4/);
  apply();

  expect(onApply).toHaveBeenCalledWith({ minPrice: 5000, minRating: 4 });
});

// source: Excel ITN-21 - keyword, duration (min/max days), country or city
test("itineraries: keyword, days range, country and city", async () => {
  const onApply = vi.fn();
  render(
    <FilterPanel
      kind="itineraries"
      onApply={onApply}
      countries={[{ code: "EG", name: "Egypt", currency: "EGP" }]}
      cities={[{ cityId: "cairo", name: "Cairo", countryCode: "EG" }]}
    />,
  );

  fireEvent.change(screen.getByRole("textbox", { name: /^keyword/i }), { target: { value: "nile" } });
  type(/^min days/i, "3");
  type(/^max days/i, "7");
  await choose(/^country/i, /^Egypt$/);
  await choose(/^city/i, /^Cairo$/);
  apply();

  expect(onApply).toHaveBeenCalledWith({ keyword: "nile", minDays: 3, maxDays: 7, country: "EG", city: "cairo" });
});

// source: team leader (23 Nov) - min days > max days: same rule as price
test("itineraries: min days above max days shows the error under Max days", () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="itineraries" onApply={onApply} countries={[]} cities={[]} />);

  type(/^min days/i, "8");
  type(/^max days/i, "7");
  apply();

  expect(errorUnder(/^max days/i)).toBe("Max days must be at least the min days");
  expect(onApply).not.toHaveBeenCalled();
});

// source: team leader (23 Nov) - Apply and Reset buttons; Reset clears every filter
test("Reset clears the fields and applies no filter", () => {
  const onApply = vi.fn();
  render(<FilterPanel kind="flights" currency="USD" onApply={onApply} initial={{ minPrice: 15000 }} />);

  expect((screen.getByRole("spinbutton", { name: /^min price/i }) as HTMLInputElement).value).toBe("150");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));

  expect((screen.getByRole("spinbutton", { name: /^min price/i }) as HTMLInputElement).value).toBe("");
  expect(onApply).toHaveBeenCalledWith({});
});
