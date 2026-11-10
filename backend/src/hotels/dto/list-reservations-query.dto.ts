// Area: Hotels & Rooms
// Used by: GET /api/hotels/:id/reservations (query)
// Requirements: HTL-22, GEN-05
//
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BookingStatus } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListReservationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
