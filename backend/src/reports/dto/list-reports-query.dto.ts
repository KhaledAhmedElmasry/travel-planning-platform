import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ContentType, ReportStatus } from '../../common/enums';

// Area: Community & Cross-cutting
// Used by: GET /api/admin/reports (query)
// Requirements: GEN-09, GEN-10, GEN-05

export class ListReportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus, {
    message: 'status must be a valid ReportStatus',
  })
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ContentType, {
    message: 'contentType must be a valid ContentType',
  })
  contentType?: ContentType;
}
