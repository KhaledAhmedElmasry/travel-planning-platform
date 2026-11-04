import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: PATCH /api/flights/:id (body)
// Requirements: FLT-05, GEN-06, NEW-02
//
// Send only the fields to change. The FLT-03 rules still apply (checked in FlightsService).
// Airports cannot change once the flight has any booking. Fares and seat counts are edited per
// cabin (PATCH /api/flights/:id/cabins/:cabinId).

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateFlightDto {
  @IsOptional()
  @Transform(toUpper)
  @IsString({ message: 'departureAirport must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'departureAirport must be a 3-letter IATA code (e.g. CAI)',
  })
  departureAirport?: string;

  @IsOptional()
  @Transform(toUpper)
  @IsString({ message: 'arrivalAirport must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'arrivalAirport must be a 3-letter IATA code (e.g. DXB)',
  })
  arrivalAirport?: string;

  // Local time at the departure airport, e.g. 2027-03-01T15:00.
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'departureLocal must be text' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
    message: 'departureLocal must be a local time like 2027-03-01T15:00',
  })
  departureLocal?: string;

  // Local time at the arrival airport, e.g. 2027-03-01T20:35.
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'arrivalLocal must be text' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
    message: 'arrivalLocal must be a local time like 2027-03-01T20:35',
  })
  arrivalLocal?: string;
}
