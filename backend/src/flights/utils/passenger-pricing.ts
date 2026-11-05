// Area: Flight Search & Booking
// Requirement: FLT-12 (passenger types and prices).
// All amounts are integer cents of the platform currency (PAY-04); nothing is converted.
import { BadRequestException } from '@nestjs/common';

// FLT-12: an infant pays 10% of the cabin fare.
export const INFANT_FARE_PERCENT = 10;

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
  // Adults and children need a seat; infants travel on an adult's lap.
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

// FLT-12: at least one adult, and no more infants than adults (one lap per adult).
export function validatePassengerCounts(
  adults: number,
  children: number,
  infants: number,
): PassengerCounts {
  if (adults < 1) {
    throw new BadRequestException('At least one adult is required.');
  }
  if (infants > adults) {
    throw new BadRequestException('Infants cannot outnumber adults.');
  }
  return { adults, children, infants, seatsRequired: adults + children };
}

// FLT-12: adults and children pay the cabin fare, infants 10% of it (rounded to whole cents).
export function calculatePassengerPricing(
  cabinFare: number,
  passengers: PassengerCounts,
): PassengerPriceBreakdown {
  const infantFare = Math.round((cabinFare * INFANT_FARE_PERCENT) / 100);
  const adultsSubtotal = passengers.adults * cabinFare;
  const childrenSubtotal = passengers.children * cabinFare;
  const infantsSubtotal = passengers.infants * infantFare;
  return {
    adultFare: cabinFare,
    childFare: cabinFare,
    infantFare,
    adultsSubtotal,
    childrenSubtotal,
    infantsSubtotal,
    totalPrice: adultsSubtotal + childrenSubtotal + infantsSubtotal,
  };
}
