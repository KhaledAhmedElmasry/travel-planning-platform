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

// Used by: PATCH /api/reviews/:id (body), HTL-23.
export class UpdateReviewDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimOptionalText(value))
  @IsString()
  @MaxLength(1000)
  text?: string;
}
