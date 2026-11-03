import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BookingStatus, BookingType } from '../../common/enums';

// Area: Auth & Accounts
// Used by: GET /api/admin/bookings (query)
// Requirements: ACC-17, GEN-05

export class ListBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BookingType, {
    message: 'type must be a valid booking type (flight or hotel)',
  })
  type?: BookingType;

  @IsOptional()
  @IsEnum(BookingStatus, {
    message: 'status must be a valid booking status',
  })
  status?: BookingStatus;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'from must be a valid ISO date string (YYYY-MM-DD)' },
  )
  from?: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'to must be a valid ISO date string (YYYY-MM-DD)' },
  )
  to?: string;
}
