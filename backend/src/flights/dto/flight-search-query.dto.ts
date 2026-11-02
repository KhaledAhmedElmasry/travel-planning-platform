// Requirements: FLT-11, GEN-02, GEN-05, GEN-13.
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_FLIGHT_SEARCH_PAGE = 1;
export const FLIGHT_SEARCH_PAGE_SIZE = 10;
// TODO(FLT-11): confirm the passenger ceiling when the requirements sheet defines one.
export const MAX_PASSENGERS_PER_SEARCH = 99;

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

  @ApiProperty({
    example: 2,
    minimum: 1,
    maximum: MAX_PASSENGERS_PER_SEARCH,
  })
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least 1 passenger.' })
  @Max(MAX_PASSENGERS_PER_SEARCH, {
    message: `cannot exceed ${MAX_PASSENGERS_PER_SEARCH} passengers.`,
  })
  passengers: number;

  @ApiPropertyOptional({
    example: DEFAULT_FLIGHT_SEARCH_PAGE,
    minimum: 1,
    default: DEFAULT_FLIGHT_SEARCH_PAGE,
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? DEFAULT_FLIGHT_SEARCH_PAGE : value,
  )
  @Type(() => Number)
  @IsInt({ message: 'must be a whole number.' })
  @Min(1, { message: 'must be at least page 1.' })
  page: number = DEFAULT_FLIGHT_SEARCH_PAGE;
}
