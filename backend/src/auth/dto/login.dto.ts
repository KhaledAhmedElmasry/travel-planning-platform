import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// Area: Auth & Accounts
// Used by: POST /api/auth/login (body), openapi.yaml "LoginRequest"
// Requirements: ACC-04, ACC-05
//
// The password rules (ACC-01) are not checked here: a wrong password gets the generic 401, and
// accounts created before a rule change must still be able to log in.

const trimAndLowercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(trimAndLowercase)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsString({ message: 'Password is required' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
