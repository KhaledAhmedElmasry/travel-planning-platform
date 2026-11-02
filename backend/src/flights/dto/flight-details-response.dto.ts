// Requirement: FLT-17.
import { ApiProperty } from '@nestjs/swagger';
import type { CabinCategory } from '../placeholders/flight.schema';

export class FlightDetailsAirlineDto {
  @ApiProperty({ example: '665f1c2a9b1e8a0012340101' })
  id: string;

  @ApiProperty({ example: 'Example Airways' })
  name: string;

  @ApiProperty({ example: 'EX', nullable: true })
  code: string | null;

  @ApiProperty({ example: null, nullable: true })
  logoUrl: string | null;
}

export class FlightDetailsAirportDto {
  @ApiProperty({ example: 'CAI' })
  id: string;

  @ApiProperty({ example: 'CAI' })
  iataCode: string;

  @ApiProperty({ example: 'Cairo International Airport' })
  name: string;

  @ApiProperty({ example: 'Cairo' })
  city: string;

  @ApiProperty({ example: 'Egypt' })
  country: string;

  @ApiProperty({ example: 'Africa/Cairo' })
  timeZone: string;
}

export class FlightDetailsExtraBaggageDto {
  @ApiProperty({
    example: 5000,
    description: 'Airline price per extra bag in its stored currency.',
  })
  pricePerExtraBag: number;

  @ApiProperty({ example: 2 })
  maxExtraBagsPerPassenger: number;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'For a cabin this is its per-bag weight allowance.',
  })
  maxWeightKgPerBag: number | null;
}

export class FlightDetailsFreeBaggageDto {
  @ApiProperty({ example: 1 })
  bags: number;

  @ApiProperty({ example: 23 })
  maxWeightKgPerBag: number;
}

export class FlightDetailsCabinDto {
  @ApiProperty({ enum: ['Economy', 'Premium Economy', 'Business', 'First'] })
  category: CabinCategory;

  @ApiProperty({ example: 25000 })
  price: number;

  @ApiProperty({ example: 18 })
  seatsRemaining: number;

  @ApiProperty({ example: false })
  soldOut: boolean;

  @ApiProperty({ type: () => FlightDetailsFreeBaggageDto })
  freeBaggage: FlightDetailsFreeBaggageDto;

  @ApiProperty({
    type: () => FlightDetailsExtraBaggageDto,
    nullable: true,
  })
  extraBaggage: FlightDetailsExtraBaggageDto | null;
}

export class FlightDetailsCancellationTierDto {
  @ApiProperty({ example: 7 })
  daysBeforeDeparture: number;

  @ApiProperty({ example: 80 })
  refundPercentage: number;

  @ApiProperty({
    example: 'Cancel 7 or more days before departure: 80% refund',
  })
  description: string;
}

export class FlightDetailsCancellationPolicyDto {
  @ApiProperty({ type: [FlightDetailsCancellationTierDto] })
  tiers: FlightDetailsCancellationTierDto[];

  @ApiProperty({
    example: 'No refund is available after booking.',
    nullable: true,
  })
  note: string | null;
}

export class FlightDetailsResponseDto {
  @ApiProperty({ example: '665f1c2a9b1e8a0012340201' })
  id: string;

  @ApiProperty({ type: () => FlightDetailsAirlineDto })
  airline: FlightDetailsAirlineDto;

  @ApiProperty({ example: 'EX101' })
  flightNumber: string;

  @ApiProperty({
    example: 'Scheduled',
    enum: ['Scheduled', 'Cancelled', 'Departed'],
  })
  status: string;

  @ApiProperty({ type: () => FlightDetailsAirportDto })
  departureAirport: FlightDetailsAirportDto;

  @ApiProperty({ type: () => FlightDetailsAirportDto })
  arrivalAirport: FlightDetailsAirportDto;

  @ApiProperty({ example: '2026-11-02T02:30:00.000+02:00' })
  departureLocal: string;

  @ApiProperty({ example: '2026-11-02T04:30:00.000+04:00' })
  arrivalLocal: string;

  @ApiProperty({ example: '2026-11-02T00:30:00.000Z' })
  departureUtc: string;

  @ApiProperty({ example: '2026-11-02T00:30:00.000Z' })
  arrivalUtc: string;

  @ApiProperty({ example: 120 })
  durationMinutes: number;

  @ApiProperty({ type: [FlightDetailsCabinDto] })
  cabins: FlightDetailsCabinDto[];

  @ApiProperty({
    type: () => FlightDetailsExtraBaggageDto,
    nullable: true,
  })
  extraBaggage: FlightDetailsExtraBaggageDto | null;

  @ApiProperty({ type: () => FlightDetailsCancellationPolicyDto })
  cancellationPolicy: FlightDetailsCancellationPolicyDto;

  @ApiProperty({ example: true })
  bookable: boolean;

  @ApiProperty({ example: null, nullable: true })
  bookableReason: string | null;
}
