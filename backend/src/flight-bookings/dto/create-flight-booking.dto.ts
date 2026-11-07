// FLT-19 and FLT-21 use the same request shape as the seat-hold endpoint (FLT-22).
import { FlightBookingRequestDto } from './hold-flight-booking.dto';

export class CreateFlightBookingDto extends FlightBookingRequestDto {}
