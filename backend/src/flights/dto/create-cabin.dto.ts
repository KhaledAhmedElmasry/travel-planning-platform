import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsPositive, Min } from 'class-validator';
import { CabinClass } from '../../common/enums';

// Area: Airlines & Flight Inventory
// Used by: POST /api/flights/:id/cabins (body)
// Requirements: FLT-04
//
// One cabin class per flight from the fixed set (checked in FlightsService).

export class CreateCabinDto {
  @IsEnum(CabinClass, {
    message: `cabinClass must be one of: ${Object.values(CabinClass).join(', ')}`,
  })
  cabinClass: CabinClass;

  // Seat count, a whole number greater than 0.
  @Type(() => Number)
  @IsInt({ message: 'seats must be a whole number' })
  @Min(1, { message: 'seats must be greater than 0' })
  seats: number;

  // Fare per seat in integer cents of the platform currency (e.g. 25000 = 250.00).
  @Type(() => Number)
  @IsInt({ message: 'price must be a whole number of cents' })
  @Min(1, { message: 'price must be greater than 0' })
  price: number;

  // Free baggage allowance per passenger (number of bags).
  @Type(() => Number)
  @IsInt({ message: 'freeBags must be a whole number' })
  @Min(0, { message: 'freeBags must not be negative' })
  freeBags: number;

  // Maximum weight per bag in kg (greater than 0).
  @Type(() => Number)
  @IsNumber({}, { message: 'maxBagWeightKg must be a number' })
  @IsPositive({ message: 'maxBagWeightKg must be greater than 0' })
  maxBagWeightKg: number;
}
