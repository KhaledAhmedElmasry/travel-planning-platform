import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: PUT /api/airlines/:id/cancellation-policy (body)
// Requirements: FLT-09
//
// Replaces all the airline's tiers. An empty list means no refunds. Unique thresholds are checked
// in AirlinesService (findDuplicateThreshold in common/utils).

export class CancellationTierDto {
  // Days before departure, a whole number of 0 or more.
  @Type(() => Number)
  @IsInt({ message: 'daysBefore must be a whole number' })
  @Min(0, { message: 'daysBefore must not be negative' })
  daysBefore: number;

  // Refund percentage from 0 to 100.
  @Type(() => Number)
  @IsNumber({}, { message: 'refundPercentage must be a number' })
  @Min(0, { message: 'refundPercentage must be between 0 and 100' })
  @Max(100, { message: 'refundPercentage must be between 0 and 100' })
  refundPercentage: number;
}

export class CancellationPolicyDto {
  @IsArray({ message: 'tiers must be a list' })
  @ArrayMaxSize(20, { message: 'tiers must have at most 20 tiers' })
  @ValidateNested({ each: true })
  @Type(() => CancellationTierDto)
  tiers: CancellationTierDto[];
}
