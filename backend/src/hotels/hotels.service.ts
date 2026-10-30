import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  CancellationTier,
  RefundTier,
} from '../payments/interfaces/payable-booking.interface';

// Area: Hotels & Rooms
// Business logic and database access for: HTL-01..HTL-06, HTL-08..HTL-12, HTL-15, HTL-22

// The hotel rules a reservation needs (HTL-09, HTL-10): shown before payment (PAY-02) and used
// for refunds (HTL-21).
export interface HotelBookingPoliciesData {
  hotelId: string;
  name: string;
  // HH:mm (HTL-09).
  checkInTime: string;
  checkOutTime: string;
  cancellationTiers: CancellationTier[];
}

@Injectable()
export class HotelsService {
  // TODO: implement.

  // --- Used by hotel bookings (Area 1: PAY-02, HTL-21) ---

  // WAITING FOR (Area 7, HTL-01 / HTL-09 / HTL-10): the hotel schema with its check-in and
  // check-out times and cancellation tiers.
  // TODO(HTL-09, HTL-10; Area 7): find the hotel (null if it does not exist) and return its name,
  // checkInTime, checkOutTime and cancellationTiers sorted by daysBefore (highest first).
  getBookingPolicies(
    _hotelId: string,
  ): Promise<HotelBookingPoliciesData | null> {
    throw new NotImplementedException(
      'Hotel policies are not implemented yet (HTL-09, HTL-10).',
    );
  }

  // WAITING FOR (Area 7, HTL-10): the cancellation tiers and the shared tier rule in common/utils
  // (FLT-09, also used by AirlinesService.getRefundTier()).
  // TODO(HTL-10; Area 7): apply the rule to the hotel's tiers: the tier with the highest
  // daysBefore that is not more than daysBeforeCheckIn; if none applies, 0% and null.
  // Example: tiers 14 -> 100%, 3 -> 50%; 5 days left -> { refundPercentage: 50, tierDaysBefore: 3 }.
  getRefundTier(
    _hotelId: string,
    _daysBeforeCheckIn: number,
  ): Promise<RefundTier> {
    throw new NotImplementedException(
      'Hotel cancellation tiers are not implemented yet (HTL-10).',
    );
  }
}
