// Area: Flight Search & Booking
// Used by: GET /api/flights/search (query)
// Requirements: FLT-11, FLT-12, FLT-15, GEN-05
// Field names and values exactly as in docs/api/openapi.yaml (GET /api/flights/search).
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { CabinClass } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto';

// openapi TripType.
export enum TripType {
  OneWay = 'one_way',
  RoundTrip = 'round_trip',
}

// openapi FlightSortBy.
export enum FlightSortBy {
  Price = 'price',
  Duration = 'duration',
  DepartureTime = 'departure_time',
}

// openapi SortOrder.
export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const toUpperTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class SearchFlightsQueryDto extends PaginationQueryDto {
  // IATA code of the departure airport, e.g. CAI.
  @Transform(toUpperTrimmed)
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'origin must be a 3-letter IATA code.' })
  origin: string;

  // IATA code of the arrival airport, e.g. DXB.
  @Transform(toUpperTrimmed)
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'destination must be a 3-letter IATA code.',
  })
  destination: string;

  // Local date at the departure airport (YYYY-MM-DD only, no time).
  @IsString()
  @Matches(DATE_ONLY, { message: 'departureDate must be YYYY-MM-DD.' })
  departureDate: string;

  @IsOptional()
  @IsEnum(TripType)
  tripType?: TripType = TripType.OneWay;

  // Required for round_trip (checked in the service).
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY, { message: 'returnDate must be YYYY-MM-DD.' })
  returnDate?: string;

  // FLT-12: adults (12+) and children (2-11) need a seat; infants (under 2) do not.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  infants?: number = 0;

  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;

  // FLT-15: inclusive range of the cabin fare, in integer cents of the platform currency.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(FlightSortBy)
  sortBy?: FlightSortBy = FlightSortBy.DepartureTime;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.Asc;
}
