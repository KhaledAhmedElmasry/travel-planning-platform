import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Reference Data & Seeding
// Used by: GET /api/attractions (query), filtered by city (e.g. cairo)
// Requirements: GEN-12, GEN-05

export class ListAttractionsQueryDto extends PaginationQueryDto {
  // city_id from the official cities dataset, e.g. cairo (any letter case).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'city must be a city id (e.g. cairo)' })
  @MaxLength(100, { message: 'city must be at most 100 characters' })
  city?: string;
}
