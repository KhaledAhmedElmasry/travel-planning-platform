import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto';

// Area: Search & My Bookings
// Used by: GET /api/flights/:id/bookings (query)
// Requirement: FLT-29

export enum FlightManifestStatus {
  Confirmed = BookingStatus.Confirmed,
  Cancelled = BookingStatus.Cancelled,
}

export class ListFlightManifestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FlightManifestStatus)
  status?: FlightManifestStatus;
}
