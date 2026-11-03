// Requirement: FLT-12.
import { BadRequestException } from '@nestjs/common';
import {
  calculatePassengerPricing,
  validatePassengerCounts,
} from './passenger-pricing';

describe('passenger pricing and validation (FLT-12)', () => {
  it('charges infants ten percent of the fare', () => {
    const passengers = validatePassengerCounts(1, 0, 1);
    expect(calculatePassengerPricing(100, passengers)).toMatchObject({
      infantFare: 10,
      infantsSubtotal: 10,
      totalPrice: 110,
    });
  });

  it('does not count infants as seats', () => {
    expect(validatePassengerCounts(1, 1, 1).seatsRequired).toBe(2);
  });

  it('rejects more infants than adults', () => {
    expect(() => validatePassengerCounts(1, 0, 2)).toThrow(BadRequestException);
  });

  it('rejects zero adults', () => {
    expect(() => validatePassengerCounts(0, 1, 0)).toThrow(BadRequestException);
  });

  it('calculates passenger totals with the infant discount', () => {
    const passengers = validatePassengerCounts(1, 1, 1);
    expect(calculatePassengerPricing(12.345, passengers)).toMatchObject({
      adultFare: 12.35,
      childFare: 12.35,
      infantFare: 1.23,
      adultsSubtotal: 12.35,
      childrenSubtotal: 12.35,
      infantsSubtotal: 1.23,
      totalPrice: 25.92,
    });
  });
});
