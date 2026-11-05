// Area: Itineraries
// Used by: PATCH /api/transport-costs/:id (body)
// Requirements: ITN-16
//
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { TransportMode } from '../../common/enums';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateTransportCostDto {
  @IsOptional()
  @IsMongoId({ message: 'dayId must be a valid id' })
  dayId?: string;

  @IsOptional()
  @IsEnum(TransportMode, {
    message: 'mode must be flight, train, bus, car, ferry or other',
  })
  mode?: TransportMode;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'fromCityId must be text' })
  fromCityId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'toCityId must be text' })
  toCityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @Min(0, { message: 'amount must be non-negative' })
  amount?: number;

  @IsOptional()
  @Transform(uppercase)
  @IsString({ message: 'currency must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter uppercase code',
  })
  currency?: string;
}
