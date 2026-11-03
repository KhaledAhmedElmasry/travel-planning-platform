import { FLIGHT_SEARCH_PAGE_SIZE } from './flight-search-query.dto';

export class FlightSearchAirlineDto {
  id: string;
  name: string;
  logoUrl: string | null;
}

export class FlightSearchAirportDto {
  iataCode: string;
  name: string;
  cityId: string;
  countryCode: string;
  timeZone: string;
}

export class FlightSearchPriceBreakdownDto {
  adultFare: number;
  childFare: number;
  infantFare: number;
  adultsSubtotal: number;
  childrenSubtotal: number;
  infantsSubtotal: number;
}

export class FlightSearchCabinDto {
  category: string;
  price: number;
  priceBreakdown: FlightSearchPriceBreakdownDto;
  totalPrice: number;
  availableSeats: number;
  freeBags: number;
  maxBagWeightKg: number;
}

export class FlightSearchItemDto {
  flightId: string;
  flightNumber: string;
  airline: FlightSearchAirlineDto;
  departureAirport: FlightSearchAirportDto;
  arrivalAirport: FlightSearchAirportDto;
  departureLocal: string;
  arrivalLocal: string;
  departureUtc: Date;
  arrivalUtc: Date;
  durationMinutes: number;
  cabins: FlightSearchCabinDto[];
}

export class FlightSearchResponseDto {
  items: FlightSearchItemDto[];
  total: number;
  page: number;
  pageSize: number = FLIGHT_SEARCH_PAGE_SIZE;
  totalPages: number;
  seatsRequired: number;
  message?: string;
}

export class RoundTripFlightSearchResponseDto {
  tripType = 'round_trip' as const;
  outbound: FlightSearchResponseDto;
  return: FlightSearchResponseDto;
}
