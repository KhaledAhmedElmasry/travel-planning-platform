import { IsInt, IsMongoId, IsNotEmpty, Min } from 'class-validator';

// Area: Itineraries
// Used by: PATCH /api/itineraries/:id/days/reorder (body), openapi.yaml "ReorderDaysRequest"
// Requirements: ITN-08, GEN-02
//
// The upper bound of position (the number of days) depends on the itinerary, so the service
// checks it after loading the itinerary.
export class ReorderDaysDto {
  @IsNotEmpty({ message: 'dayId is required' })
  @IsMongoId({ message: 'dayId must be a valid id' })
  dayId: string;

  @IsNotEmpty({ message: 'position is required' })
  @IsInt({ message: 'position must be a whole number' })
  @Min(1, { message: 'position must be at least 1' })
  position: number;
}
