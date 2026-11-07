import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';

// Area: Hotels & Rooms
// Used by: GET /api/hotels/search (query), and by Area 6 through HotelSearchService (ITN-25)
// Requirements: HTL-11, GEN-05
// Give city or country (or both). checkIn is the arrival day and checkOut the departure day.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SearchHotelsQueryDto extends PaginationQueryDto {
  // city_id from the official cities dataset, e.g. cairo.
  @IsOptional()
  @Transform(trim)
  @IsString()
  city?: string;

  // Country code from the official countries dataset, e.g. EG.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be a 2-letter country code, e.g. EG',
  })
  country?: string;

  @Matches(DATE_PATTERN, {
    message: 'checkIn must be a date in the format YYYY-MM-DD, e.g. 2027-03-01',
  })
  checkIn: string;

  @Matches(DATE_PATTERN, {
    message:
      'checkOut must be a date in the format YYYY-MM-DD, e.g. 2027-03-05',
  })
  checkOut: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rooms?: number = 1;
}
