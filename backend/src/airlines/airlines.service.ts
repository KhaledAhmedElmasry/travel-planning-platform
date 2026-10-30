import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  CancellationTier,
  RefundTier,
} from '../payments/interfaces/payable-booking.interface';

// Area: Airlines & Flight Inventory
// Business logic and database access for: FLT-01, FLT-04, FLT-08, FLT-09

// The airline rules a flight booking needs (FLT-08, FLT-09): shown before payment (PAY-02) and
// used for refunds (FLT-26).
export interface AirlineBookingPolicies {
  airlineId: string;
  name: string;
  cancellationTiers: CancellationTier[];
  // Integer cents of the platform currency (FLT-08).
  extraBagPrice: number;
  maxExtraBagsPerPassenger: number;
}

@Injectable()
export class AirlinesService {
  // TODO: implement.

  // --- Used by flight bookings (Area 1: PAY-02, FLT-26) ---

  // WAITING FOR (Area 5, FLT-01 / FLT-08 / FLT-09): the airline schema with its baggage policy and
  // cancellation tiers.
  // TODO(FLT-08, FLT-09; Area 5): find the airline (null if it does not exist) and return its name,
  // cancellationTiers sorted by daysBefore (highest first), extraBagPrice and
  // maxExtraBagsPerPassenger.
  getBookingPolicies(
    _airlineId: string,
  ): Promise<AirlineBookingPolicies | null> {
    throw new NotImplementedException(
      'Airline policies are not implemented yet (FLT-08, FLT-09).',
    );
  }

  // WAITING FOR (Area 5, FLT-09): the cancellation tiers and the shared tier rule in
  // common/utils (also used by HTL-10).
  // TODO(FLT-09; Area 5): apply the rule to the airline's tiers: the tier with the highest
  // daysBefore that is not more than daysBeforeDeparture; if none applies, 0% and null.
  // Example: tiers 30 -> 100%, 7 -> 50%; 10 days left -> { refundPercentage: 50, tierDaysBefore: 7 }.
  getRefundTier(
    _airlineId: string,
    _daysBeforeDeparture: number,
  ): Promise<RefundTier> {
    throw new NotImplementedException(
      'Airline cancellation tiers are not implemented yet (FLT-09).',
    );
  }
}
