import { IsMongoId, ValidateIf } from 'class-validator';

// Used by: PATCH /api/posts/:id/itinerary (body), BLG-13.
export class AttachItineraryDto {
  // Null is the explicit detach operation. Undefined is still validated, so the field is required.
  @ValidateIf((_object, value) => value !== null)
  @IsMongoId()
  itineraryId: string | null;
}
