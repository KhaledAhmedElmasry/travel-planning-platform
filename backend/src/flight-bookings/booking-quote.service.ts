import { Injectable, NotImplementedException } from '@nestjs/common';
import { FlightBookingRequestDto } from './dto/hold-flight-booking.dto';
import { FlightBookingQuote } from './interfaces/flight-booking-quote.interface';

// Area: Search & My Bookings
// Requirements: FLT-19, FLT-21, FLT-12
// The booking summary: shown by POST /api/flight-bookings (Area 6) and reused by the seat hold
// POST /api/flight-bookings/hold (FLT-22, Area 1), which stores the result on the booking.
//
// WAITING FOR (Area 6): implement quote(). It also needs the flight + cabin data (Area 5:
// FLT-03, FLT-04, FLT-30) and the airline's baggage policy (FLT-08).
@Injectable()
export class FlightBookingQuoteService {
  // TODO(FLT-19, FLT-21, FLT-12; Area 6): return the FlightBookingQuote for the request, or throw:
  //   - 404 if a flight does not exist;
  //   - 409 if a flight is not Scheduled (FLT-30), has departed, its airline is deactivated
  //     (ACC-15), the cabin does not exist on that flight, or not enough seats are free
  //     (total - booked - held; the hold re-checks this atomically);
  //   - 400 if a round trip's second flight is not the reverse route after the outbound flight,
  //     a passenger type does not match the date of birth on the departure date (adult 12+,
  //     child 2-11, infant under 2), there is no adult, there are more infants than adults, a
  //     passenger has more extra bags than the airline's maximum or a bag is heavier than the
  //     cabin's maxBagWeightKg (FLT-08, FLT-12, FLT-19).
  //   Prices (integer cents, platform currency): adults and children pay the cabin fare on each
  //   segment, infants 10% of it; extra bags cost the airline's extraBagPrice each; seats =
  //   adults + children; totalAmount = all fares + baggage fees.
  quote(_request: FlightBookingRequestDto): Promise<FlightBookingQuote> {
    throw new NotImplementedException(
      'The booking summary is not implemented yet (FLT-19, FLT-21).',
    );
  }
}
