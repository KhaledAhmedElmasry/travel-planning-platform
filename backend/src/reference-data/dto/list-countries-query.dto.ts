import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Reference Data & Seeding
// Used by: GET /api/countries (query)
// Requirements: NEW-05, GEN-12, GEN-05

export class ListCountriesQueryDto extends PaginationQueryDto {
  // Part of the country code or name, case-insensitive (e.g. "eg" or "egy").
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'search must be text' })
  @MaxLength(100, { message: 'search must be at most 100 characters' })
  search?: string;
}
