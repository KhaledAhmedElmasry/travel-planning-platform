import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: PATCH /api/airlines/:id (body, multipart/form-data with an optional "logo" file)
// Requirements: FLT-01
//
// Send only the fields to change. A new logo replaces the old one (airline-logo.ts, GEN-08).
// Swagger UI sends every form field, also the ones left empty (name="", code=""): an empty field
// means "not changed", so the moderator can type only the field to change.
const blankToUndefined = (value: unknown, upper = false): unknown => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (text === '') return undefined;
  return upper ? text.toUpperCase() : text;
};

export class UpdateAirlineDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => blankToUndefined(value))
  @IsString({ message: 'name must be text' })
  @IsNotEmpty({ message: 'name should not be empty' })
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => blankToUndefined(value, true))
  @IsString({ message: 'code must be text' })
  @Matches(/^[A-Z0-9]{2,3}$/, {
    message: 'code must be 2 or 3 letters or digits (e.g. MS)',
  })
  code?: string;
}
