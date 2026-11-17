import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';

// Area: Search & My Bookings
// Used by: GET /api/flight-bookings (query)
// Requirements: FLT-25, GEN-05

export enum FlightBookingGroup {
  Upcoming = 'upcoming',
  Past = 'past',
  Cancelled = 'cancelled',
}

export class ListFlightBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FlightBookingGroup)
  group: FlightBookingGroup = FlightBookingGroup.Upcoming;
}
