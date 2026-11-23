// Checks the Vitest + React Testing Library setup on a kit component.
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { cleanup } from "@testing-library/react";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

// source: Excel FLT-11 - show "no flights found" when no match exists; GEN-04 - friendly empty state
test("shows the empty-state title as a heading", () => {
  render(<EmptyState title="no flights found" />);
  expect(screen.getByRole("heading", { name: "no flights found" })).toBeDefined();
});
