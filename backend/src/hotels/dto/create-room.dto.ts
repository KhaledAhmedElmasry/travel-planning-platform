import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// POST /api/hotels/:id/rooms (HTL-03)
export class CreateRoomDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  roomNumber: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @IsInt()
  @Min(1)
  beds: number;

  @IsInt()
  @Min(1)
  maxOccupancy: number;

  // Integer cents of the platform currency, greater than 0.
  @IsInt()
  @Min(1)
  pricePerNight: number;
}
