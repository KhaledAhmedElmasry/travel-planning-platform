// Area: Itineraries
// Used by: GET /api/itineraries/:id/flights (query)
// Requirements: ITN-26
//
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { CabinClass } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { TripType } from '../../flights/dto/search-flights-query.dto';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class ItineraryFlightsQueryDto extends PaginationQueryDto {
  @Transform(upper)
  @Matches(/^[A-Z]{3}$/, { message: 'origin must be a 3-letter IATA code.' })
  origin: string;

  @IsOptional()
  @IsEnum(TripType)
  tripType?: TripType = TripType.OneWay;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'departureDate must be YYYY-MM-DD.' })
  departureDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'returnDate must be YYYY-MM-DD.' })
  returnDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  infants?: number = 0;

  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;
}
