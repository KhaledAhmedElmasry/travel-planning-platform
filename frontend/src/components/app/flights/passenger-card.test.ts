// P-14 passenger rules (FLT-19, FLT-12, FLT-08) checked before any request. Errors are keyed by the backend's
// field names (openapi Error.fieldErrors, GEN-02), so only the keys are asserted: the texts are not in the sources.
import { expect, test } from "vitest";
import { ageOn, passengerErrors, type BaggageRules, type PassengerInput, type PassengerType } from "./passenger-card";

const DEPARTURE = "2027-03-01";
// source: Excel FLT-08 "Each extra bag has the same maximum weight as the cabin's free baggage allowance"
const baggage: BaggageRules = { extraBagPrice: 5000, maxExtraBags: 2, maxBagWeightKg: 23, currency: "USD" };
const p = (type: PassengerType, dateOfBirth: string, extraBags: number[] = []): PassengerInput => ({
  type,
  fullName: "Mona Hassan",
  dateOfBirth,
  passportNumber: "A1234567",
  extraBags,
});
const keys = (passengers: PassengerInput[]) => Object.keys(passengerErrors(passengers, baggage, DEPARTURE)).sort();

// source: Excel FLT-12 (b) "the type is validated against the date of birth" - full years on the departure date
test.each([
  ["2015-03-01", 12],
  ["2015-03-02", 11],
  ["2025-03-01", 2],
  ["2025-03-02", 1],
])("born %s is %i on 2027-03-01", (dob, age) => {
  expect(ageOn(dob, DEPARTURE)).toBe(age);
});

// source: Excel FLT-12 (b) "adult (12+), child (2-11) and infant (<2) ... the type is validated against the date of birth"
test.each<[PassengerType, string, string[]]>([
  ["adult", "2015-03-01", []],
  ["adult", "2015-03-02", ["passengers.0.dateOfBirth"]],
  ["child", "2025-03-01", []],
  ["child", "2015-03-02", []],
  ["child", "2015-03-01", ["passengers.0.dateOfBirth"]],
  ["child", "2025-03-02", ["passengers.0.dateOfBirth"]],
  ["infant", "2025-03-02", []],
  ["infant", "2025-03-01", ["passengers.0.dateOfBirth"]],
])("%s born %s", (type, dob, expected) => {
  expect(keys([p(type, dob)])).toEqual(expected);
});

// source: Excel FLT-19 "enter each passenger's full name, date of birth and passport/ID number"
test("an empty passenger is refused on all three fields", () => {
  expect(keys([{ type: "adult", fullName: "  ", dateOfBirth: "", passportNumber: "", extraBags: [] }])).toEqual([
    "passengers.0.dateOfBirth",
    "passengers.0.fullName",
    "passengers.0.passportNumber",
  ]);
});

// source: Excel FLT-19 the errors belong to the passenger they are about
test("errors carry the passenger's index", () => {
  const blankName = { ...p("adult", "1990-01-01"), fullName: "" };
  expect(keys([p("adult", "1990-01-01"), blankName])).toEqual(["passengers.1.fullName"]);
});

// source: Excel FLT-08 extra bag max weight = the cabin's (23 kg here); FLT-19 "extra baggage (bags and weight)"
test.each<[string, number, string[]]>([
  ["at the limit", 23, []],
  ["over the limit", 23.5, ["passengers.0.extraBags.0.weightKg"]],
  ["with no weight", Number.NaN, ["passengers.0.extraBags.0.weightKg"]],
])("an extra bag %s", (_, weight, expected) => {
  expect(keys([p("adult", "1990-01-01", [weight])])).toEqual(expected);
});
