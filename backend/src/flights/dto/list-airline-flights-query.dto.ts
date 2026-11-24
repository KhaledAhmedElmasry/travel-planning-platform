import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FlightStatus } from '../schemas/flight.schema';

// Area: Airlines & Flight Inventory
// Used by: GET /api/airlines/:id/flights (query)
// Requirements: FLT-03, FLT-05, GEN-05 (new endpoint, MILESTONE2 spec section 8)
// from / to: the flight's local departure date at its departure airport, both ends included.

export class ListAirlineFlightsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FlightStatus, {
    message: 'status must be scheduled, cancelled or departed',
  })
  status?: FlightStatus;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a date (YYYY-MM-DD)',
  })
  @IsDateString(
    { strict: true },
    { message: 'from must be a date (YYYY-MM-DD)' },
  )
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be a date (YYYY-MM-DD)',
  })
  @IsDateString({ strict: true }, { message: 'to must be a date (YYYY-MM-DD)' })
  to?: string;
}
