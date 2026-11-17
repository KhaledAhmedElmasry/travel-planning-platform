import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: POST /api/flights (body)
// Requirements: FLT-03, GEN-06
//
// Codes are accepted in any letter case and stored in upper case. The business rules (airports
// in the list, different airports, future departure, arrival after departure, unique flight
// number per date) are checked in FlightsService.

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFlightDto {
  @Transform(toUpper)
  @IsString({ message: 'flightNumber must be text' })
  @Matches(/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/, {
    message: 'flightNumber must look like MS911',
  })
  flightNumber: string;

  @Transform(toUpper)
  @IsString({ message: 'departureAirport must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'departureAirport must be a 3-letter IATA code (e.g. CAI)',
  })
  departureAirport: string;

  @Transform(toUpper)
  @IsString({ message: 'arrivalAirport must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'arrivalAirport must be a 3-letter IATA code (e.g. DXB)',
  })
  arrivalAirport: string;

  // Local time at the departure airport, e.g. 2027-03-01T14:30.
  @Transform(trim)
  @IsString({ message: 'departureLocal must be text' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
    message: 'departureLocal must be a local time like 2027-03-01T14:30',
  })
  departureLocal: string;

  // Local time at the arrival airport, e.g. 2027-03-01T20:05.
  @Transform(trim)
  @IsString({ message: 'arrivalLocal must be text' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
    message: 'arrivalLocal must be a local time like 2027-03-01T20:05',
  })
  arrivalLocal: string;
}
