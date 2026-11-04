import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: POST /api/airlines (body, multipart/form-data with an optional "logo" file)
// Requirements: FLT-01
//
// The logo file itself is checked in airline-logo.ts (JPG or PNG, at most 5 MB, GEN-08).

export class CreateAirlineDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'name must be text' })
  @IsNotEmpty({ message: 'name should not be empty' })
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name: string;

  // e.g. MS. Accepted in any letter case and stored in upper case.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'code must be text' })
  @Matches(/^[A-Z0-9]{2,3}$/, {
    message: 'code must be 2 or 3 letters or digits (e.g. MS)',
  })
  code: string;
}
