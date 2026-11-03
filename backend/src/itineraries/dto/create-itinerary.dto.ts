import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Area: Itineraries
// Used by: POST /api/itineraries (body), openapi.yaml "CreateItineraryRequest"
// Requirements: ITN-01

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeCountryCodes = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((code: unknown) =>
        typeof code === 'string' ? code.trim().toUpperCase() : code,
      )
    : value;

export class CreateItineraryDto {
  @Transform(trim)
  @IsString({ message: 'Title must be text' })
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title: string;

  @Transform(normalizeCountryCodes)
  @IsArray({ message: 'countryCodes must be an array' })
  @ArrayMinSize(1, { message: 'Select at least one country' })
  @ArrayUnique({ message: 'countryCodes must not contain duplicates' })
  @IsString({ each: true, message: 'Each countryCode must be text' })
  @Matches(/^[A-Z]{2}$/, {
    each: true,
    message: 'Each countryCode must be a two-letter uppercase code',
  })
  countryCodes: string[];

  @IsDateString({ strict: true }, { message: 'startDate must be a valid date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be a date (YYYY-MM-DD)',
  })
  startDate: string;
}
