// Area: Hotel Booking & Reviews
// Used by: GET /api/hotel-bookings (query)
// Requirements: HTL-20, GEN-05
//
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export enum BookingGroup {
  Upcoming = 'upcoming',
  Past = 'past',
  Cancelled = 'cancelled',
}

export class ListHotelBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BookingGroup)
  group: BookingGroup = BookingGroup.Upcoming;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
