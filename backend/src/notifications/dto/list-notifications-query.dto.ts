import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Community & Cross-cutting
// Used by: GET /api/notifications (query)
// Requirements: GEN-01, GEN-05

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === false || value === 0 || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean({ message: 'unreadOnly must be a boolean' })
  unreadOnly?: boolean;
}
