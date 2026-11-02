// Requirements: FLT-11, FLT-12, GEN-02, GEN-05, GEN-13.
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CabinClass } from '../../common/enums';
import { CABIN_CATEGORIES } from '../placeholders/flight.schema';
import { MAX_TOTAL_PASSENGERS } from '../utils/passenger-pricing';
import {
  FlightSortBy,
  FlightSortOrder,
  OPENAPI_DEPARTURE_TIME_SORT,
} from '../utils/flight-sorting';

export const DEFAULT_FLIGHT_SEARCH_PAGE = 1;
export const FLIGHT_SEARCH_PAGE_SIZE = 10;

export enum FlightSearchTripType {
  OneWay = 'one-way',
  RoundTrip = 'round-trip',
}

const CABIN_CLASS_INPUTS: Record<string, CabinClass> = {
  Economy: CabinClass.Economy,
  'Premium Economy': CabinClass.PremiumEconomy,
  Business: CabinClass.Business,
  First: CabinClass.First,
  [CabinClass.Economy]: CabinClass.Economy,
  [CabinClass.PremiumEconomy]: CabinClass.PremiumEconomy,
  [CabinClass.Business]: CabinClass.Business,
  [CabinClass.First]: CabinClass.First,
};

export class FlightSearchQueryDto {
  @ApiProperty({ example: 'CAI', description: 'Departure airport IATA code.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'must be a 3-letter airport code.' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'must be exactly 3 letters (for example, CAI).',
  })
  from: string;

  @ApiProperty({ example: 'DXB', description: 'Arrival airport IATA code.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'must be a 3-letter airport code.' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'must be exactly 3 letters (for example, DXB).',
  })
  to: string;

  @ApiProperty({
    example: '2026-11-02',
    description: 'Departure date in the departure airport’s local time.',
  })
  @IsString({ message: 'must be a date in YYYY-MM-DD format.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'must use the YYYY-MM-DD format.',
  })
  @IsDateString(
    { strict: true },
    { message: 'must be a real calendar date in YYYY-MM-DD format.' },
  )
  date: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: MAX_TOTAL_PASSENGERS,
    description:
      'At least one adult is required. If omitted, deprecated passengers is used.',
  })
  @ValidateIf(
    (query: FlightSearchQueryDto) =>
      query.adults !== undefined || query.passengers === undefined,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least 1 adult.' })
  @Max(MAX_TOTAL_PASSENGERS, {
    message: `cannot exceed ${MAX_TOTAL_PASSENGERS} passengers.`,
  })
  adults?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    maximum: MAX_TOTAL_PASSENGERS,
    default: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 0 : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(0, { message: 'cannot be negative.' })
  @Max(MAX_TOTAL_PASSENGERS, {
    message: `cannot exceed ${MAX_TOTAL_PASSENGERS} passengers.`,
  })
  children?: number = 0;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    maximum: MAX_TOTAL_PASSENGERS,
    default: 0,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 0 : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(0, { message: 'cannot be negative.' })
  @Max(MAX_TOTAL_PASSENGERS, {
    message: `cannot exceed ${MAX_TOTAL_PASSENGERS} passengers.`,
  })
  infants?: number = 0;

  @ApiPropertyOptional({
    enum: FlightSearchTripType,
    default: FlightSearchTripType.OneWay,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined
      ? FlightSearchTripType.OneWay
      : value === 'one_way'
        ? FlightSearchTripType.OneWay
        : value === 'round_trip'
          ? FlightSearchTripType.RoundTrip
          : value,
  )
  @IsEnum(FlightSearchTripType, {
    message: 'must be either one-way or round-trip.',
  })
  tripType?: FlightSearchTripType = FlightSearchTripType.OneWay;

  @ApiPropertyOptional({
    example: '2026-11-03',
    description:
      'Return departure local date at the original arrival airport; required for round-trip and rejected for one-way.',
  })
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

  @ApiPropertyOptional({
    enum: CABIN_CATEGORIES,
    example: 'Economy',
    description: 'Optional cabin category filter.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (CABIN_CLASS_INPUTS[value] ?? value) : value,
  )
  @IsOptional()
  @IsEnum(CabinClass, {
    message: 'must be economy, premium_economy, business, or first.',
  })
  cabin?: CabinClass;

  @ApiPropertyOptional({
    example: 10000,
    minimum: 0,
    description: 'Inclusive minimum cabin total price for the passenger mix.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'must be a valid number.' },
  )
  @Min(0, { message: 'must be at least 0.' })
  minPrice?: number;

  @ApiPropertyOptional({
    example: 50000,
    minimum: 0,
    description: 'Inclusive maximum cabin total price for the passenger mix.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'must be a valid number.' },
  )
  @Min(0, { message: 'must be at least 0.' })
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: FlightSortBy,
    default: FlightSortBy.DepartureTime,
    example: FlightSortBy.Price,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === OPENAPI_DEPARTURE_TIME_SORT ? FlightSortBy.DepartureTime : value,
  )
  @IsOptional()
  @IsEnum(FlightSortBy, {
    message: 'must be price, duration, or departureTime.',
  })
  sortBy?: FlightSortBy = FlightSortBy.DepartureTime;

  @ApiPropertyOptional({
    enum: FlightSortOrder,
    default: FlightSortOrder.Ascending,
    example: FlightSortOrder.Ascending,
  })
  @IsOptional()
  @IsEnum(FlightSortOrder, {
    message: 'must be asc or desc.',
  })
  sortOrder?: FlightSortOrder = FlightSortOrder.Ascending;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: DEFAULT_FLIGHT_SEARCH_PAGE,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? DEFAULT_FLIGHT_SEARCH_PAGE : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least page 1.' })
  page?: number = DEFAULT_FLIGHT_SEARCH_PAGE;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: DEFAULT_FLIGHT_SEARCH_PAGE,
    description: 'Page number for the return leg.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? DEFAULT_FLIGHT_SEARCH_PAGE : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least page 1.' })
  returnPage?: number = DEFAULT_FLIGHT_SEARCH_PAGE;

  @ApiPropertyOptional({
    deprecated: true,
    example: 2,
    minimum: 1,
    maximum: MAX_TOTAL_PASSENGERS,
    description:
      'Deprecated FLT-11 alias for adults; used only when adults is absent.',
  })
  @ValidateIf((query: FlightSearchQueryDto) => query.adults === undefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least 1 passenger.' })
  @Max(MAX_TOTAL_PASSENGERS, {
    message: `cannot exceed ${MAX_TOTAL_PASSENGERS} passengers.`,
  })
  passengers?: number;
}
