import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

// Area: Payments, Holds & Booking Engine
// Used by: PATCH /api/flight-bookings/:id/seat (body)
// Requirements: FLT-28 (bonus)
export class SelectSeatDto {
  @IsInt({ message: 'passengerIndex must be a whole number' })
  @Min(0, { message: 'passengerIndex cannot be negative' })
  passengerIndex: number;

  @IsOptional()
  @IsIn(['outbound', 'return'], {
    message: 'segment must be outbound or return',
  })
  segment?: 'outbound' | 'return';

  // Row number and one letter, for example 12A. Whether the seat exists is checked against the
  // cabin's size.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'seatNumber is required' })
  @Matches(/^[1-9]\d{0,2}[A-Z]$/, {
    message: 'seatNumber must be a row number and a letter, for example 12A',
  })
  seatNumber: string;
}
