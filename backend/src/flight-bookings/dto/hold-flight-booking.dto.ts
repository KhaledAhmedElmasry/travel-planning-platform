import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CabinClass, PassengerType } from '../../common/enums';

// Area: Payments, Holds & Booking Engine
// Used by: POST /api/flight-bookings/hold (body), openapi.yaml "FlightBookingRequest"
// Requirements: FLT-22 (same body as POST /api/flight-bookings, FLT-19 / FLT-21)
//
// Only the shape of the request is checked here. The business rules (passenger type matches the
// date of birth, at least one adult, no more infants than adults, extra-bag limits) belong to the
// booking summary (FLT-12, FLT-19; Area 6) in FlightBookingQuoteService.quote().
// Area 6 can reuse this class for POST /api/flight-bookings.

export class FlightSegmentDto {
  @IsMongoId({ message: 'flightId must be a valid id' })
  flightId: string;

  @IsEnum(CabinClass, {
    message: 'cabinClass must be economy, premium_economy, business or first',
  })
  cabinClass: CabinClass;
}

export class ExtraBagDto {
  @IsNumber({}, { message: 'weightKg must be a number' })
  @IsPositive({ message: 'weightKg must be greater than 0' })
  weightKg: number;
}

export class PassengerDto {
  @IsEnum(PassengerType, { message: 'type must be adult, child or infant' })
  type: PassengerType;

  // \S = at least one character that is not a space ("   " is not a name).
  @IsString()
  @Length(1, 100, { message: 'fullName must be 1 to 100 characters' })
  @Matches(/\S/, { message: 'fullName must not be blank' })
  fullName: string;

  @IsDateString({ strict: true }, { message: 'dateOfBirth must be a date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth: string;

  @IsString()
  @Length(1, 20, { message: 'passportNumber must be 1 to 20 characters' })
  @Matches(/\S/, { message: 'passportNumber must not be blank' })
  passportNumber: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraBagDto)
  extraBags?: ExtraBagDto[];
}

export class FlightBookingRequestDto {
  // One segment for one-way; two for a round trip, outbound first (FLT-12).
  @IsArray()
  @ArrayMinSize(1, { message: 'segments must contain 1 or 2 flights' })
  @ArrayMaxSize(2, { message: 'segments must contain 1 or 2 flights' })
  @ValidateNested({ each: true })
  @Type(() => FlightSegmentDto)
  segments: FlightSegmentDto[];

  @IsArray()
  @ArrayMinSize(1, {
    message: 'passengers must contain at least one passenger',
  })
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers: PassengerDto[];
}
