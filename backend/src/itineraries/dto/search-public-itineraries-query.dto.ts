// Area: Itineraries
// Used by: GET /api/itineraries/public/search (query)
// Requirements: ITN-20, ITN-21, GEN-05

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Query parameters accepted by the guest-accessible public itinerary list. */
export class SearchPublicItinerariesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDays?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
