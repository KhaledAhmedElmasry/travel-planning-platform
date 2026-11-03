import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditAction } from '../../common/enums';

// Area: Community & Cross-cutting
// Used by: GET /api/admin/audit-logs (query)
// Requirements: GEN-07, GEN-05

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AuditAction, {
    message: 'action must be a valid AuditAction',
  })
  action?: AuditAction;

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
