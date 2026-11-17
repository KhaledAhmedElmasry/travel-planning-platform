import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Area: Itineraries
// Used by: PATCH /api/itineraries/:id/days/:dayId (body), openapi.yaml "UpdateDayRequest"
// Requirements: ITN-05

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Send only the fields to change. Sending notes as "" clears them.
export class UpdateDayDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'cityId must be text' })
  @IsNotEmpty({ message: 'cityId cannot be empty' })
  cityId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Notes must be text' })
  @MaxLength(1000, { message: 'Notes must be at most 1000 characters' })
  notes?: string;
}
