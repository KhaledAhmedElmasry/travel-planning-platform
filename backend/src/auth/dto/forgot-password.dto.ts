import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Auth & Accounts (bonus)
// Used by: POST /api/auth/forgot-password (body), openapi.yaml "ForgotPasswordRequest"
// Requirements: ACC-07
export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;
}
