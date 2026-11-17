// Area: Itineraries
// Used by: GET /api/itineraries/:id/hotels (query)
// Requirements: ITN-25
//
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ItineraryHotelsQueryDto extends PaginationQueryDto {
  @IsString()
  @IsNotEmpty()
  dayId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rooms = 1;
}
