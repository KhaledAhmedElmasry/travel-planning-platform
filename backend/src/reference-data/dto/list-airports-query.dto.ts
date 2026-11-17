import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Reference Data & Seeding
// Used by: GET /api/airports (query)
// Requirements: FLT-02, GEN-05

export class ListAirportsQueryDto extends PaginationQueryDto {
  // Part of the IATA code, airport name or city name, case-insensitive (e.g. "cai").
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'search must be text' })
  @MaxLength(100, { message: 'search must be at most 100 characters' })
  search?: string;

  // city_id from the official cities dataset, e.g. cairo (any letter case).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'city must be a city id (e.g. cairo)' })
  @MaxLength(100, { message: 'city must be at most 100 characters' })
  city?: string;

  // Country code from the official countries dataset, e.g. EG (any letter case).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be a 2-letter country code (e.g. EG)',
  })
  country?: string;
}
