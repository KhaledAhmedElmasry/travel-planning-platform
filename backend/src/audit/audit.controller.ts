import { Controller } from '@nestjs/common';
import { AuditService } from './audit.service';

// Area: Community & Cross-cutting
// Requirements: GEN-07
// Endpoints to implement (PDF section 8):
//   GET /api/admin/audit-logs   GEN-07
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // TODO: add the endpoints listed above.
}
