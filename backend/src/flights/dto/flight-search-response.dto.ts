// Area: Flight Search & Booking
// Response of GET /api/flights/search (FLT-11, FLT-12, FLT-15, GEN-05, GEN-06).
// All prices are integer cents of `currency` (the platform currency, PAY-04).
import type { PaginatedList } from '../../common/dto';
import type { CabinClass } from '../../common/enums';
import type { TripType } from './search-flights-query.dto';

export interface FlightSearchAirline {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

export interface FlightSearchAirport {
  iataCode: string;
  name: string;
  cityId: string;
  countryCode: string;
  timeZone: string;
}

export interface FlightSearchPriceBreakdown {
  adultFare: number;
  childFare: number;
  infantFare: number;
  adultsSubtotal: number;
  childrenSubtotal: number;
  infantsSubtotal: number;
}

export interface FlightSearchCabin {
  cabinId: string;
  cabinClass: CabinClass;
  // Fare per seat (FLT-15 filters and sorts on this).
  price: number;
  availableSeats: number;
  freeBags: number;
  maxBagWeightKg: number;
  // FLT-12: price of the searched passengers in this cabin.
  priceBreakdown: FlightSearchPriceBreakdown;
  totalPrice: number;
  currency: string;
}

export interface FlightSearchItem {
  id: string;
  flightNumber: string;
  airline: FlightSearchAirline;
  departureAirport: FlightSearchAirport;
  arrivalAirport: FlightSearchAirport;
  // GEN-06: local time at each airport, its UTC offset at that moment, and the UTC time.
  departureLocal: string;
  arrivalLocal: string;
  departureUtcOffset: string;
  arrivalUtcOffset: string;
  departureAt: Date;
  arrivalAt: Date;
  durationMinutes: number;
  cabins: FlightSearchCabin[];
}

export interface FlightSearchPage extends PaginatedList<FlightSearchItem> {
  // Seats the search needs per flight (adults + children, FLT-12).
  seatsRequired: number;
  // GEN-04: a friendly text when nothing matches.
  message?: string;
}

export interface RoundTripFlightSearchResult {
  tripType: TripType.RoundTrip;
  outbound: FlightSearchPage;
  return: FlightSearchPage;
}
