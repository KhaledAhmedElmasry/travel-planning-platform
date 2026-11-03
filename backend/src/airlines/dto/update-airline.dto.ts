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

export class UpdateAirlineDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'name must be text' })
  @IsNotEmpty({ message: 'name should not be empty' })
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'code must be text' })
  @Matches(/^[A-Z0-9]{2,3}$/, {
    message: 'code must be 2 or 3 letters or digits (e.g. MS)',
  })
  code?: string;
}
