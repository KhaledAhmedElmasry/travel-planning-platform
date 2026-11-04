import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

// Area: Airlines & Flight Inventory
// Used by: PATCH /api/flights/:id/cabins/:cabinId (body)
// Requirements: FLT-04, FLT-05
//
// Send only the fields to change. The cabin class cannot change. The seat count cannot go below
// the seats already booked or held (checked in FlightsService). A new price does not change
// existing bookings, which keep their agreed price (NEW-02).

export class UpdateCabinDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'seats must be a whole number' })
  @Min(1, { message: 'seats must be greater than 0' })
  seats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'price must be a whole number of cents' })
  @Min(1, { message: 'price must be greater than 0' })
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'freeBags must be a whole number' })
  @Min(0, { message: 'freeBags must not be negative' })
  freeBags?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxBagWeightKg must be a number' })
  @IsPositive({ message: 'maxBagWeightKg must be greater than 0' })
  maxBagWeightKg?: number;
}
