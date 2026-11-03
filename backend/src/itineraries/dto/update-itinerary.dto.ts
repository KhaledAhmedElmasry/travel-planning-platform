import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Area: Itineraries
// Used by: PATCH /api/itineraries/:id (body), openapi.yaml "UpdateItineraryRequest"
// Requirements: ITN-01

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeCountryCodes = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((code: unknown) =>
        typeof code === 'string' ? code.trim().toUpperCase() : code,
      )
    : value;

export class UpdateItineraryDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Title must be text' })
  @IsNotEmpty({ message: 'Title cannot be empty' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title?: string;

  @IsOptional()
  @Transform(normalizeCountryCodes)
  @IsArray({ message: 'countryCodes must be an array' })
  @ArrayMinSize(1, { message: 'Select at least one country' })
  @ArrayUnique({ message: 'countryCodes must not contain duplicates' })
  @IsString({ each: true, message: 'Each countryCode must be text' })
  @Matches(/^[A-Z]{2}$/, {
    each: true,
    message: 'Each countryCode must be a two-letter uppercase code',
  })
  countryCodes?: string[];

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'startDate must be a valid date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be a date (YYYY-MM-DD)',
  })
  startDate?: string;
}
