import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Area: Payments, Holds & Booking Engine
// Used by: POST /api/hotel-bookings (body), openapi.yaml "HotelBookingRequest"
// Requirements: HTL-16, HTL-18
//
// Only the shape is checked here. The rules that need the dates or the rooms (check-out after
// check-in, check-in not in the past, at least one adult, one guest per room at least, each room
// once, maximum occupancy, same hotel) are checked in HotelBookingsService.book().

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class RoomGuestsDto {
  @IsMongoId({ message: 'roomId must be a valid id' })
  roomId: string;

  @IsInt({ message: 'adults must be a whole number' })
  @Min(0, { message: 'adults must be 0 or more' })
  adults: number;

  // One age per child in this room (HTL-16: children are 0-17).
  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'childrenAges must be whole numbers' })
  @Min(0, { each: true, message: 'a child must be 0 to 17 years old' })
  @Max(17, { each: true, message: 'a child must be 0 to 17 years old' })
  childrenAges?: number[];
}

export class CreateHotelBookingDto {
  @IsMongoId({ message: 'hotelId must be a valid id' })
  hotelId: string;

  @IsDateString({ strict: true }, { message: 'checkIn must be a date' })
  @Matches(DATE_ONLY, { message: 'checkIn must be YYYY-MM-DD' })
  checkIn: string;

  @IsDateString({ strict: true }, { message: 'checkOut must be a date' })
  @Matches(DATE_ONLY, { message: 'checkOut must be YYYY-MM-DD' })
  checkOut: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'rooms must contain at least one room' })
  @ValidateNested({ each: true })
  @Type(() => RoomGuestsDto)
  rooms: RoomGuestsDto[];
}
