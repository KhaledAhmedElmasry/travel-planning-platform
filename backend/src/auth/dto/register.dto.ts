import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../password-rule';

// Area: Auth & Accounts
// Used by: POST /api/auth/register (body), openapi.yaml "RegisterRequest"
// Requirements: ACC-01
//
// There is no role field: a role sent in the body is stripped by the ValidationPipe
// (whitelist: true), so nobody can register as an admin or moderator (ACC-01, ACC-18).

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndLowercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString({ message: 'Name must be text' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name: string;

  @Transform(trimAndLowercase)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  // Not trimmed: spaces are allowed in passwords and must be kept as typed.
  @IsString({ message: 'Password is required' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;

  // The mandatory terms-and-privacy consent checkbox. Only the JSON value true is accepted.
  @Equals(true, {
    message: 'You must accept the terms and privacy policy to register',
  })
  acceptTerms: boolean;
}
