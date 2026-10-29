import { Controller } from '@nestjs/common';
import { ReportsService } from './reports.service';

// Area: Community & Cross-cutting
// Requirements: GEN-09, GEN-10
// Endpoints to implement (PDF section 8):
//   GET    /api/admin/reports              GEN-09, GEN-10
//   PATCH  /api/admin/reports/:id          GEN-10
//   DELETE /api/admin/content/:type/:id    GEN-10
// Extra endpoints may be needed (not in the PDF tables) for:
//   a registered user reporting content (GEN-09)
//   the admin hiding content directly (GEN-10: "hide or delete any post, comment, review or
//   itinerary directly")
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // TODO: add the endpoints listed above.
}
