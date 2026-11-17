import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Swagger UI sends every form field, also the ones left empty (name="", starRating=""): an empty
// field means "not changed", so the moderator can type only the field to change.
const trim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return text === '' ? undefined : text;
};
const toNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return Number(value);
};

// Swagger UI sends an array field in multipart as ONE comma-separated value ("wifi,pool"), while
// Postman or code sends the field once per item. Accept both.
const toList = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return (Array.isArray(value) ? value : [value])
    .flatMap((item: unknown) =>
      typeof item === 'string' ? item.split(',') : [item],
    )
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
    .filter((item: unknown) => item !== '');
};

// Send only the fields to change (PATCH).
export class UpdateHotelDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  cityId?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be 2 uppercase letters, e.g. EG',
  })
  countryCode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating?: number;

  // Replaces the whole amenity list.
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  amenities?: string[];

  // Ids of photos to remove.
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsString({ each: true })
  removePhotoIds?: string[];
}
