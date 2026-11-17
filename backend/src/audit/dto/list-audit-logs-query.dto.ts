import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a date (YYYY-MM-DD)',
  })
  @IsDateString(
    { strict: true },
    { message: 'from must be a date (YYYY-MM-DD)' },
  )
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be a date (YYYY-MM-DD)',
  })
  @IsDateString({ strict: true }, { message: 'to must be a date (YYYY-MM-DD)' })
  to?: string;
}
