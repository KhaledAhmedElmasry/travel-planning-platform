import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Area: Auth & Accounts
// Used by: PATCH /api/users/me (body), openapi.yaml "UpdateProfileRequest"
// Requirements: ACC-09
//
// Send only the fields to change. Every sent field is validated; if one fails, nothing is saved.
// Other fields (email, role, status, password...) are stripped by the ValidationPipe, so they can
// never be changed here. The currency is also checked against the supported list in UsersService.

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndUppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/;

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Name must be text' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Phone number must be text' })
  // An empty phone number removes the phone (team leader, 23 Nov), so only a non-empty one is checked.
  @ValidateIf((dto: UpdateProfileDto) => dto.phone !== '')
  @Matches(PHONE_PATTERN, {
    message:
      'Phone number must be 7 to 20 characters: digits, spaces, ( ) and -, optionally starting with +',
  })
  phone?: string;

  @IsOptional()
  @Transform(trimAndUppercase)
  @IsString({ message: 'Preferred currency must be text' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'Preferred currency must be a 3-letter currency code, e.g. EUR',
  })
  preferredCurrency?: string;
}
