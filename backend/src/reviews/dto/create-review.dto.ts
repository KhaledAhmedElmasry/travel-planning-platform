import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

function trimOptionalText(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// Used by: POST /api/hotel-bookings/:id/review (body), HTL-23.
export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimOptionalText(value))
  @IsString()
  @MaxLength(1000)
  text?: string;
}
