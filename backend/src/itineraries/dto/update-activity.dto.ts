import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateActivityDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'name must be text' })
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'description must be text' })
  @IsNotEmpty({ message: 'description must not be empty' })
  @MaxLength(1000, {
    message: 'description must be at most 1000 characters',
  })
  description?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'time must be text' })
  @Matches(TIME_PATTERN, { message: 'time must be HH:mm' })
  time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'cost must be a number' })
  @Min(0, { message: 'cost must be non-negative' })
  cost?: number;

  @IsOptional()
  @Transform(uppercase)
  @IsString({ message: 'currency must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter uppercase code',
  })
  currency?: string;
}
