import { IsEnum, IsMongoId } from 'class-validator';
import { BookingType } from '../../common/enums';

// Used by: POST /api/itineraries/:id/bookings (body), ITN-27 (bonus).
export class AttachBookingDto {
  @IsEnum(BookingType, { message: 'bookingType must be flight or hotel' })
  bookingType: BookingType;

  @IsMongoId({ message: 'bookingId must be a valid id' })
  bookingId: string;

  @IsMongoId({ message: 'dayId must be a valid id' })
  dayId: string;
}
