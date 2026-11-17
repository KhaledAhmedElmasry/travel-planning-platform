import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class BudgetSummaryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'currency must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter uppercase code',
  })
  currency?: string;
}
