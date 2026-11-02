// Requirements: FLT-11, FLT-12, GEN-04, GEN-05, GEN-06.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FLIGHT_SEARCH_PAGE_SIZE } from './flight-search-query.dto';

export class FlightSearchAirlineDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'Example Airways' })
  name: string;

  @ApiProperty({ example: 'https://example.com/logo.png', nullable: true })
  logoUrl: string | null;
}

export class FlightSearchAirportDto {
  @ApiProperty({ example: 'CAI' })
  iataCode: string;

  @ApiProperty({ example: 'Cairo International Airport' })
  name: string;

  @ApiProperty({ example: 'Cairo' })
  city: string;

  @ApiProperty({ example: 'Africa/Cairo' })
  timeZone: string;
}

export class FlightSearchPriceBreakdownDto {
  @ApiProperty({ example: 25000 })
  adultFare: number;

  @ApiProperty({ example: 25000 })
  childFare: number;

  @ApiProperty({ example: 2500 })
  infantFare: number;

  @ApiProperty({ example: 50000 })
  adultsSubtotal: number;

  @ApiProperty({ example: 25000 })
  childrenSubtotal: number;

  @ApiProperty({ example: 2500 })
  infantsSubtotal: number;
}

export class FlightSearchCabinDto {
  @ApiProperty({
    example: 'Economy',
    enum: ['Economy', 'Premium Economy', 'Business', 'First'],
  })
  category: string;

  @ApiProperty({ example: 25000 })
  price: number;

  @ApiProperty({ type: FlightSearchPriceBreakdownDto })
  priceBreakdown: FlightSearchPriceBreakdownDto;

  @ApiProperty({ example: 77500 })
  totalPrice: number;

  @ApiProperty({ example: 8 })
  availableSeats: number;

  @ApiProperty({ example: 1 })
  freeBags: number;

  @ApiProperty({ example: 23 })
  maxBagWeightKg: number;
}

export class FlightSearchItemDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  flightId: string;

  @ApiProperty({ example: 'EX123' })
  flightNumber: string;

  @ApiProperty({ type: FlightSearchAirlineDto })
  airline: FlightSearchAirlineDto;

  @ApiProperty({ type: FlightSearchAirportDto })
  departureAirport: FlightSearchAirportDto;

  @ApiProperty({ type: FlightSearchAirportDto })
  arrivalAirport: FlightSearchAirportDto;

  @ApiProperty({ example: '2026-11-02T00:30:00+02:00' })
  departureLocal: string;

  @ApiProperty({ example: '2026-11-02T04:30:00+04:00' })
  arrivalLocal: string;

  @ApiProperty({ example: '2026-11-01T22:30:00.000Z' })
  departureUtc: Date;

  @ApiProperty({ example: '2026-11-02T00:30:00.000Z' })
  arrivalUtc: Date;

  @ApiProperty({ example: 120 })
  durationMinutes: number;

  @ApiProperty({ type: [FlightSearchCabinDto] })
  cabins: FlightSearchCabinDto[];
}

export class FlightSearchResponseDto {
  @ApiProperty({ type: [FlightSearchItemDto] })
  items: FlightSearchItemDto[];

  @ApiProperty({ example: 24 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: FLIGHT_SEARCH_PAGE_SIZE })
  pageSize: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({
    example: 2,
    description: 'Seats needed for each selected cabin.',
  })
  seatsRequired: number;

  @ApiPropertyOptional({ example: 'No flights found for your search.' })
  message?: string;
}

export class RoundTripFlightSearchResponseDto {
  @ApiProperty({ example: 'round-trip', enum: ['round-trip'] })
  tripType: 'round-trip';

  @ApiProperty({ type: FlightSearchResponseDto })
  outbound: FlightSearchResponseDto;

  @ApiProperty({ type: FlightSearchResponseDto, name: 'return' })
  return: FlightSearchResponseDto;
}
