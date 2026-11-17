import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Reference Data & Seeding
// Used by: GET /api/cities (query), filtered by country (e.g. EG)
// Requirements: GEN-12, GEN-05

export class ListCitiesQueryDto extends PaginationQueryDto {
  // Country code from the official countries dataset, e.g. EG (any letter case).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be a 2-letter country code (e.g. EG)',
  })
  country?: string;

  // Part of the city name or city id, case-insensitive (e.g. "cai").
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'search must be text' })
  @MaxLength(100, { message: 'search must be at most 100 characters' })
  search?: string;
}
