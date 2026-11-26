// validateTiers (FLT-09 airlines, HTL-10 hotels): the per-row checks shown before saving the tiers.
import { expect, test } from "vitest";
import { validateTiers } from "./tiers-editor";

// source: Excel FLT-09 - "a unique days-before-departure threshold (integer >=0) and a refund percentage (0-100%)"
test("valid tiers, including the 0 and 100 boundaries, give no errors", () => {
  expect(
    validateTiers([
      { daysBefore: 30, refundPercentage: 100 },
      { daysBefore: 0, refundPercentage: 0 },
    ]),
  ).toEqual({});
});

// source: team leader decision 26 Nov - refund percentages are whole numbers
test("a refund percentage with decimals is refused", () => {
  expect(validateTiers([{ daysBefore: 7, refundPercentage: 12.5 }])).toEqual({
    0: "Refund must be a whole number from 0 to 100%.",
  });
});

// source: Excel FLT-09 - refund percentage 0-100%
test.each([-1, 101, ""] as const)("a refund of %s is refused", (pct) => {
  expect(validateTiers([{ daysBefore: 7, refundPercentage: pct }])).toEqual({
    0: "Refund must be a whole number from 0 to 100%.",
  });
});

// source: Excel FLT-09 - threshold "integer >=0"
test.each([-1, 1.5, ""] as const)("days before of %s is refused", (days) => {
  expect(validateTiers([{ daysBefore: days, refundPercentage: 50 }])).toEqual({
    0: "Days must be a whole number, 0 or more.",
  });
});

// source: Excel FLT-09 - "unique" threshold
test("a second tier with the same days is refused", () => {
  expect(
    validateTiers([
      { daysBefore: 7, refundPercentage: 50 },
      { daysBefore: 7, refundPercentage: 20 },
    ]),
  ).toEqual({ 1: "Another tier already uses 7 days." });
});
