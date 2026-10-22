import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

// Area: Community & Cross-cutting
// Requirements: GEN-09, GEN-10
// Endpoints to implement (PDF section 8):
//   POST   /api/reports                    GEN-09   (not in the PDF tables; any logged-in user)
//   GET    /api/admin/reports              GEN-09, GEN-10
//   PATCH  /api/admin/reports/:id          GEN-10
//   DELETE /api/admin/content/:type/:id    GEN-10
// Also needed by the requirements (not in the PDF tables):
//   an endpoint for the admin to hide content directly (GEN-10: "hide or delete any post,
//   comment, review or itinerary directly")
@ApiTags('Reports & Moderation')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // TODO: add the endpoints listed above.
}
