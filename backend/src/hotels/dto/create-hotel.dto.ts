import { Transform, Type } from 'class-transformer';
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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

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

export class CreateHotelDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  cityId: string;

  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be 2 uppercase letters, e.g. EG',
  })
  countryCode: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  // Multipart sends numbers as strings, so convert first.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating: number;

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  amenities?: string[];
}
