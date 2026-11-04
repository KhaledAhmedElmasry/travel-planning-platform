// Area: Flight Search & Booking
// Response of GET /api/flights/:id (FLT-17, GEN-06, FLT-08, FLT-09).
// All prices are integer cents of `currency` (the platform currency, PAY-04, NEW-04).
import type { CabinClass } from '../../common/enums';
import type { FlightStatus } from '../schemas/flight.schema';
import type {
  FlightSearchAirline,
  FlightSearchAirport,
} from './flight-search-response.dto';

export interface FlightDetailsCabin {
  cabinId: string;
  cabinClass: CabinClass;
  price: number;
  seatsRemaining: number;
  soldOut: boolean;
  // Free baggage allowance per passenger (FLT-04).
  freeBags: number;
  maxBagWeightKg: number;
}

// FLT-08: extra bags cost extraBagPrice each, up to maxExtraBagsPerPassenger; each extra bag
// has the cabin's maxBagWeightKg. extraBagPrice null = not set yet (no extra bags).
export interface FlightDetailsExtraBaggage {
  extraBagPrice: number | null;
  maxExtraBagsPerPassenger: number;
}

export interface FlightDetailsCancellationTier {
  daysBefore: number;
  refundPercentage: number;
  description: string;
}

export interface FlightDetails {
  id: string;
  airline: FlightSearchAirline;
  flightNumber: string;
  status: FlightStatus;
  departureAirport: FlightSearchAirport;
  arrivalAirport: FlightSearchAirport;
  departureLocal: string;
  arrivalLocal: string;
  departureUtcOffset: string;
  arrivalUtcOffset: string;
  departureAt: Date;
  arrivalAt: Date;
  durationMinutes: number;
  cabins: FlightDetailsCabin[];
  extraBaggage: FlightDetailsExtraBaggage;
  // FLT-09: highest daysBefore first; empty = no refunds (note explains it).
  cancellationPolicy: {
    tiers: FlightDetailsCancellationTier[];
    note: string | null;
  };
  // Scheduled and not departed (FLT-30).
  bookable: boolean;
  bookableReason: string | null;
  currency: string;
}
