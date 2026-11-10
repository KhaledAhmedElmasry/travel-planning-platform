import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../password-rule';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Auth & Accounts (bonus)
// Used by: POST /api/auth/reset-password (body), openapi.yaml "ResetPasswordRequest"
// Requirements: ACC-07
export class ResetPasswordDto {
  @IsString({ message: 'Token is required' })
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @IsString({ message: 'New password is required' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
