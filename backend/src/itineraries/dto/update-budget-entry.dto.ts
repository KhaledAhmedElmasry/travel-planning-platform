import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { BudgetCategory } from '../schemas/itinerary.schema';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateBudgetEntryDto {
  @IsOptional()
  @IsEnum(BudgetCategory, {
    message:
      'category must be food, accommodation, in_city_transport or activities',
  })
  category?: BudgetCategory;

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

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'description must be text' })
  @MaxLength(200, { message: 'description must be at most 200 characters' })
  description?: string;
}
