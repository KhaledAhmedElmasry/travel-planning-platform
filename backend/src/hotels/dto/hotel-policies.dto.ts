import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// PUT /api/hotels/:id/policies (HTL-09, HTL-10)

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CancellationTierDto {
  // Days before check-in, an integer >= 0, unique within the policy.
  @IsInt()
  @Min(0)
  daysBefore: number;

  // 0 to 100.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  refundPercentage: number;
}

export class HotelPoliciesDto {
  @Matches(TIME_PATTERN, {
    message: 'checkInTime must be HH:mm between 00:00 and 23:59, e.g. 14:00',
  })
  checkInTime: string;

  @Matches(TIME_PATTERN, {
    message: 'checkOutTime must be HH:mm between 00:00 and 23:59, e.g. 12:00',
  })
  checkOutTime: string;

  // Replaces all the tiers. An empty list means no refund for any cancellation.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationTierDto)
  cancellationTiers: CancellationTierDto[];
}
