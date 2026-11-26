// FormField (GEN-02, GEN-16): each label reaches its own input, also when the same form is on the
// page twice (the search pages keep a desktop FilterPanel and a phone FilterPanel: team leader, 26 Nov,
// "Fix in the kit"); the error summary links still lead to the field.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Input } from "@/components/ui/input";
import { FormErrorSummary } from "./form-error-summary";
import { FormField } from "./form-field";
import { FilterPanel } from "./search/filter-panel";

afterEach(cleanup);

// source: Excel GEN-16 "understandable" inputs on every screen size; team leader (26 Nov): unique ids from the kit
test("with two filter panels on the page, each label reaches the input in its own panel", () => {
  render(
    <>
      <FilterPanel kind="hotels" currency="USD" onApply={() => {}} />
      <FilterPanel kind="hotels" currency="USD" onApply={() => {}} />
    </>,
  );

  const [first, second] = screen.getAllByRole("form", { name: "Filters" });
  for (const panel of [first, second]) {
    for (const label of ["Min price (USD)", "Max price (USD)"]) {
      const input = within(panel).getByLabelText(label);
      expect(panel.contains(input)).toBe(true);
    }
  }
  expect(within(first).getByLabelText("Max price (USD)")).not.toBe(within(second).getByLabelText("Max price (USD)"));
});

// source: Excel GEN-02 field-level errors linked to their field; FormErrorSummary header "each item links to its field"
test("an error summary link moves focus to its field", () => {
  render(
    <form>
      <FormErrorSummary errors={{ email: "This email is already registered." }} labels={{ email: "Email" }} autoFocus={false} />
      <FormField label="Email" name="email" error="This email is already registered.">
        <Input />
      </FormField>
    </form>,
  );

  fireEvent.click(screen.getByRole("link", { name: "Email" }));

  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Email" }));
});
