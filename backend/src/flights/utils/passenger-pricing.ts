// Requirement: FLT-12.
import { BadRequestException } from '@nestjs/common';

export const INFANT_FARE_RATE = 0.1;
const CURRENCY_DECIMAL_PLACES = 2;
const CURRENCY_ROUNDING_FACTOR = 10 ** CURRENCY_DECIMAL_PLACES;

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
  seatsRequired: number;
}

export interface PassengerPriceBreakdown {
  adultFare: number;
  childFare: number;
  infantFare: number;
  adultsSubtotal: number;
  childrenSubtotal: number;
  infantsSubtotal: number;
  totalPrice: number;
}

export function roundCurrencyAmount(amount: number): number {
  return (
    Math.round(amount * CURRENCY_ROUNDING_FACTOR) / CURRENCY_ROUNDING_FACTOR
  );
}

export function validatePassengerCounts(
  adults: number,
  children: number,
  infants: number,
): PassengerCounts {
  const counts = { adults, children, infants };
  for (const [type, count] of [
    ['adults', adults],
    ['children', children],
    ['infants', infants],
  ] as const) {
    if (!Number.isInteger(count) || count < 0) {
      throw new BadRequestException(
        `${type} must be a non-negative whole number.`,
      );
    }
  }
  if (adults < 1) {
    throw new BadRequestException('At least one adult is required.');
  }
  if (infants > adults) {
    throw new BadRequestException('Infants cannot outnumber adults.');
  }
  // Infants travel in an adult's lap and must not reserve a cabin seat.
  return { ...counts, seatsRequired: adults + children };
}

export function calculatePassengerPricing(
  cabinFare: number,
  passengers: PassengerCounts,
): PassengerPriceBreakdown {
  // Fare currency is whatever the flight stores; this calculation does not convert currency.
  const adultFare = roundCurrencyAmount(cabinFare);
  const childFare = roundCurrencyAmount(cabinFare);
  const infantFare = roundCurrencyAmount(cabinFare * INFANT_FARE_RATE);
  const adultsSubtotal = roundCurrencyAmount(passengers.adults * cabinFare);
  const childrenSubtotal = roundCurrencyAmount(passengers.children * cabinFare);
  const infantsSubtotal = roundCurrencyAmount(
    passengers.infants * cabinFare * INFANT_FARE_RATE,
  );
  const totalPrice = roundCurrencyAmount(
    (passengers.adults + passengers.children) * cabinFare +
      passengers.infants * cabinFare * INFANT_FARE_RATE,
  );
  return {
    adultFare,
    childFare,
    infantFare,
    adultsSubtotal,
    childrenSubtotal,
    infantsSubtotal,
    totalPrice,
  };
}
