import type { CabinClass } from '../../common/enums';

export class FlightDetailsAirlineDto {
  id: string;
  name: string;
  code: string | null;
  logoUrl: string | null;
}

export class FlightDetailsAirportDto {
  id: string;
  iataCode: string;
  name: string;
  cityId: string;
  countryCode: string;
  timeZone: string;
}

export class FlightDetailsExtraBaggageDto {
  pricePerExtraBag: number;
  maxExtraBagsPerPassenger: number;
  maxWeightKgPerBag: number | null;
}

export class FlightDetailsFreeBaggageDto {
  bags: number;
  maxWeightKgPerBag: number;
}

export class FlightDetailsCabinDto {
  category: CabinClass;
  price: number;
  seatsRemaining: number;
  soldOut: boolean;
  freeBaggage: FlightDetailsFreeBaggageDto;
  extraBaggage: FlightDetailsExtraBaggageDto | null;
}

export class FlightDetailsCancellationTierDto {
  daysBeforeDeparture: number;
  refundPercentage: number;
  description: string;
}

export class FlightDetailsCancellationPolicyDto {
  tiers: FlightDetailsCancellationTierDto[];
  note: string | null;
}

export class FlightDetailsResponseDto {
  id: string;
  airline: FlightDetailsAirlineDto;
  flightNumber: string;
  status: string;
  departureAirport: FlightDetailsAirportDto;
  arrivalAirport: FlightDetailsAirportDto;
  departureLocal: string;
  arrivalLocal: string;
  departureUtc: string;
  arrivalUtc: string;
  durationMinutes: number;
  cabins: FlightDetailsCabinDto[];
  extraBaggage: FlightDetailsExtraBaggageDto | null;
  cancellationPolicy: FlightDetailsCancellationPolicyDto;
  bookable: boolean;
  bookableReason: string | null;
}
