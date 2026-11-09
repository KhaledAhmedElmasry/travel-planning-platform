import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

// Area: Hotels & Rooms
// Used by: GET /api/hotels/:id (query)
// Requirements: HTL-02

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class HotelDetailsQueryDto {
  @IsOptional()
  @Matches(DATE_PATTERN, {
    message: 'checkIn must be a date in the format YYYY-MM-DD, e.g. 2027-03-01',
  })
  checkIn?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, {
    message:
      'checkOut must be a date in the format YYYY-MM-DD, e.g. 2027-03-05',
  })
  checkOut?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}
