import { RefundTier } from './interfaces/payable-booking.interface';
import { percentOfCents } from './refunds.service';

// Area: Payments, Holds & Booking Engine
// Requirements: FLT-26, HTL-21, PAY-03
// What the user would get back by cancelling now. FLT-26 and HTL-21: the user cancels "after
// viewing the refund amount". The booking details (FLT-25, HTL-20; Area 6) show it with
// FlightBookingLifecycleService / HotelBookingLifecycleService.previewCancellation(), and cancel()
// uses the same function, so the refund given is always the refund shown.
export interface CancellationPreview {
  // false: the booking cannot be cancelled now; `reason` says why.
  cancellable: boolean;
  reason: string | null;
  // Whole days left before departure / check-in, used to pick the provider's tier.
  daysBefore: number | null;
  // The provider's tier for those days; 0 when no tier applies (cancelled without a refund).
  refundPercentage: number;
  tierDaysBefore: number | null;
  // Integer cents of the platform currency (PAY-04), the same rounding as the refund itself.
  refundAmount: number;
  currency: string;
}

export function cancellablePreview(
  totalAmount: number,
  currency: string,
  daysBefore: number,
  tier: RefundTier,
): CancellationPreview {
  return {
    cancellable: true,
    reason: null,
    daysBefore,
    refundPercentage: tier.refundPercentage,
    tierDaysBefore: tier.tierDaysBefore,
    refundAmount: percentOfCents(totalAmount, tier.refundPercentage),
    currency,
  };
}

export function notCancellablePreview(
  reason: string,
  currency: string,
): CancellationPreview {
  return {
    cancellable: false,
    reason,
    daysBefore: null,
    refundPercentage: 0,
    tierDaysBefore: null,
    refundAmount: 0,
    currency,
  };
}
