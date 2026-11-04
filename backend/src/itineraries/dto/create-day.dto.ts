import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Area: Itineraries
// Used by: POST /api/itineraries/:id/days (body), openapi.yaml "CreateDayRequest"
// Requirements: ITN-05

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDayDto {
  // city_id from the predefined city list (NEW-05); the service checks it exists.
  @Transform(trim)
  @IsString({ message: 'cityId must be text' })
  @IsNotEmpty({ message: 'cityId is required' })
  cityId: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Notes must be text' })
  @MaxLength(1000, { message: 'Notes must be at most 1000 characters' })
  notes?: string;
}
