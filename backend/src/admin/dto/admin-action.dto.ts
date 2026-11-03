import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Area: Auth & Accounts
// Used by: PATCH /api/admin/accounts/:id/suspend, PATCH /api/admin/accounts/:id/reactivate
// Requirements: ACC-15, ACC-16, GEN-07

export class AdminActionDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  reason?: string;
}
