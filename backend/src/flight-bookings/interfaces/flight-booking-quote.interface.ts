import { CabinClass, PassengerType } from '../../common/enums';

// Area: Payments, Holds & Booking Engine
// The contract between the seat hold (FLT-22, Area 1) and the booking summary (FLT-19, FLT-21,
// FLT-12, Area 6). Area 6 computes the summary; the hold reserves the seats and stores exactly
// these values on the booking as the prices agreed at booking time (FLT-05).
// All amounts are integer cents of the platform currency (PAY-04).

export interface QuotedAirport {
  code: string;
  timeZone: string;
}

export interface QuotedSegment {
  flightId: string;
  flightNumber: string;
  airlineId: string;
  airlineName: string;
  cabinClass: CabinClass;
  departureAirport: QuotedAirport;
  arrivalAirport: QuotedAirport;
  departureAt: Date;
  arrivalAt: Date;
  // Cabin price per seat.
  fare: number;
  freeBags: number;
  maxBagWeightKg: number;
}

export interface QuotedPassenger {
  type: PassengerType;
  fullName: string;
  // YYYY-MM-DD
  dateOfBirth: string;
  passportNumber: string;
  extraBags: { weightKg: number }[];
  // What this passenger pays for all segments (infants 10% of the fare).
  fare: number;
  baggageFee: number;
}

export interface FlightBookingQuote {
  // Same order as the request: outbound first.
  segments: QuotedSegment[];
  passengers: QuotedPassenger[];
  // Seats needed on every segment: adults + children.
  seats: number;
  // Sum of all passenger fares and baggage fees.
  totalAmount: number;
  currency: string;
}
