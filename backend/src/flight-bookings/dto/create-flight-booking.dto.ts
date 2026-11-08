import { FlightBookingRequestDto } from './hold-flight-booking.dto';

// FLT-19 / FLT-21: the summary uses the same passenger and segment body as the hold.
export class CreateFlightBookingDto extends FlightBookingRequestDto {}
