// Requirements: FLT-11, FLT-12, GEN-02, GEN-05, GEN-13.
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { CabinClass } from '../../common/enums';
import { FlightSortBy, FlightSortOrder } from '../utils/flight-sorting';

export const DEFAULT_FLIGHT_SEARCH_PAGE = 1;
export const FLIGHT_SEARCH_PAGE_SIZE = 10;

export enum FlightSearchTripType {
  OneWay = 'one_way',
  RoundTrip = 'round_trip',
}

export class FlightSearchQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'must be a 3-letter airport code.' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'must be exactly 3 letters (for example, CAI).',
  })
  origin: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'must be a 3-letter airport code.' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'must be exactly 3 letters (for example, DXB).',
  })
  destination: string;

  @IsString({ message: 'must be a date in YYYY-MM-DD format.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'must use the YYYY-MM-DD format.',
  })
  @IsDateString(
    { strict: true },
    { message: 'must be a real calendar date in YYYY-MM-DD format.' },
  )
  departureDate: string;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 1 : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least 1 adult.' })
  adults?: number = 1;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 0 : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(0, { message: 'cannot be negative.' })
  children?: number = 0;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 0 : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(0, { message: 'cannot be negative.' })
  infants?: number = 0;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? FlightSearchTripType.OneWay : value,
  )
  @IsEnum(FlightSearchTripType, {
    message: 'must be either one_way or round_trip.',
  })
  tripType?: FlightSearchTripType = FlightSearchTripType.OneWay;

  @IsOptional()
  @IsString({ message: 'must be a date in YYYY-MM-DD format.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'must use the YYYY-MM-DD format.',
  })
  @IsDateString(
    { strict: true },
    { message: 'must be a real calendar date in YYYY-MM-DD format.' },
  )
  returnDate?: string;

  @IsOptional()
  @IsEnum(CabinClass, {
    message: 'must be economy, premium_economy, business, or first.',
  })
  cabinClass?: CabinClass;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'must be a whole number of cents.' })
  @Min(0, { message: 'must be at least 0.' })
  minPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'must be a whole number of cents.' })
  @Min(0, { message: 'must be at least 0.' })
  maxPrice?: number;

  @IsOptional()
  @IsEnum(FlightSortBy, {
    message: 'must be price, duration, or departure_time.',
  })
  sortBy?: FlightSortBy = FlightSortBy.DepartureTime;

  @IsOptional()
  @IsEnum(FlightSortOrder, {
    message: 'must be asc or desc.',
  })
  sortOrder?: FlightSortOrder = FlightSortOrder.Ascending;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? DEFAULT_FLIGHT_SEARCH_PAGE : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least page 1.' })
  page?: number = DEFAULT_FLIGHT_SEARCH_PAGE;
}
