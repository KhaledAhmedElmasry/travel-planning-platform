import { Controller } from '@nestjs/common';
import { ReferenceDataService } from './reference-data.service';

// Area: Reference Data & Seeding
// Requirements: FLT-02, GEN-12, NEW-05
// Endpoints to implement (PDF section 8):
//   GET /api/airports   FLT-03, FLT-11
// Extra endpoints may be needed (not in the PDF tables) for:
//   reading countries, cities, attractions and the supported currency list (NEW-05, GEN-12,
//   ACC-09, ITN-18)
// Notes:
//   The airports endpoint returns the predefined, read-only airport list (FLT-02).
//   All public and read-only. Use the official ids from the datasets (EG, cairo, CAI, att-1).
//   Export lookups so other modules can reject unknown countries, cities and airports (NEW-05, FLT-02).
@Controller()
export class ReferenceDataController {
  constructor(private readonly referenceDataService: ReferenceDataService) {}

  // TODO: add the endpoints listed above.
}
