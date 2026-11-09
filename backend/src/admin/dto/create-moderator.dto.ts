import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PASSWORD_PATTERN,
  PASSWORD_RULE_MESSAGE,
} from '../../auth/password-rule';
import { Role } from '../../common/enums';

// Area: Auth & Accounts
// Used by: POST /api/admin/moderators (body)
// Requirements: ACC-13, GEN-01-B

export class CreateModeratorDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'A valid email is required' })
  email: string;

  @IsIn([Role.AirlineModerator, Role.HotelModerator], {
    message: 'role must be either airline_moderator or hotel_moderator',
  })
  role: Role.AirlineModerator | Role.HotelModerator;

  @IsMongoId({ message: 'providerId must be a valid ObjectId' })
  providerId: string;

  @Matches(PASSWORD_PATTERN, {
    message: PASSWORD_RULE_MESSAGE,
  })
  temporaryPassword: string;
}
