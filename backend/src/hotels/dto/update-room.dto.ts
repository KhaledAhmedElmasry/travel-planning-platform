import { IsInt, IsOptional, Min } from 'class-validator';

// PATCH /api/hotels/:id/rooms/:roomId (HTL-05)
// Send only the fields to change. The room number and type stay as they were created (HTL-03).
export class UpdateRoomDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  beds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  // Integer cents of the platform currency, greater than 0. Existing reservations keep the price
  // they were booked at (Area 1 stores it on the reservation).
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerNight?: number;
}
