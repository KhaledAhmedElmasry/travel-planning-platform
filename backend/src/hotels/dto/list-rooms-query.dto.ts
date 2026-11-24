import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Hotels & Rooms
// Used by: GET /api/hotels/:id/rooms (query)
// Requirements: HTL-03, HTL-06, GEN-05 (new endpoint, MILESTONE2 spec section 8)

export class ListRoomsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'active must be true or false' })
  active?: boolean;
}
