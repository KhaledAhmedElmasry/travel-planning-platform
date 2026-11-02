import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../password-rule';

// Area: Auth & Accounts
// Used by: PATCH /api/auth/change-password (body), openapi.yaml "ChangePasswordRequest"
// Requirements: ACC-08
//
// The current password is only checked against the stored hash, so it is not held to the rules
// (an old password or a temporary one from ACC-07a must still be accepted here).
export class ChangePasswordDto {
  @IsString({ message: 'Current password is required' })
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @IsString({ message: 'New password is required' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
