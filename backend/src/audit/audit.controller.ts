import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

// Area: Community & Cross-cutting
// Requirements: GEN-07
// Endpoints to implement (PDF section 8):
//   GET /api/admin/audit-logs   GEN-07

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // GEN-07: View the audit log of admin actions
  @Get()
  getAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }
}
