import { IsString, Matches } from 'class-validator';
import {
  PASSWORD_PATTERN,
  PASSWORD_RULE_MESSAGE,
} from '../../auth/password-rule';

// Area: Auth & Accounts
// Used by: POST /api/admin/users/:id/reset-password (body), openapi.yaml "AdminResetPasswordRequest"
// Requirements: ACC-07a
//
// The temporary password must meet the same rules as any password (ACC-01). The account must
// replace it at its next login.
export class AdminResetPasswordDto {
  @IsString({ message: 'Temporary password is required' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  temporaryPassword: string;
}
