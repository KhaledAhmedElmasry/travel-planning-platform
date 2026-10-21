import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';

// Owner: Member 3 (Community & Cross-cutting)
// Requirements: GEN-07
// Endpoints to implement (PDF section 8):
//   GET /api/admin/audit-logs   GEN-07
@ApiTags('Admin')
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // TODO: add the endpoints listed above.
}
