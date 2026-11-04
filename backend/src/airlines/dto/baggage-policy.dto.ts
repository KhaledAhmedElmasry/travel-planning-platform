import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: PUT /api/airlines/:id/baggage-policy (body)
// Requirements: FLT-04, FLT-08
//
// The extra-baggage policy for all of the airline's flights. The free allowance (bags and maximum
// weight per bag) is set per cabin (FLT-04); extra bags have the same maximum weight.

export class BaggagePolicyDto {
  // Price per extra bag in integer cents of the platform currency (e.g. 3000 = 30.00), > 0.
  @Type(() => Number)
  @IsInt({ message: 'extraBagPrice must be a whole number of cents' })
  @Min(1, { message: 'extraBagPrice must be greater than 0' })
  extraBagPrice: number;

  // Maximum number of extra bags per passenger, >= 0 (0 = no extra bags).
  @Type(() => Number)
  @IsInt({ message: 'maxExtraBagsPerPassenger must be a whole number' })
  @Min(0, { message: 'maxExtraBagsPerPassenger must not be negative' })
  maxExtraBagsPerPassenger: number;
}
