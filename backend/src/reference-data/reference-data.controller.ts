import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReferenceDataService } from './reference-data.service';

// Area: Reference Data & Seeding
// Requirements: FLT-02, GEN-12, NEW-05
// Endpoints to implement (PDF section 8):
//   GET /api/airports   FLT-02, FLT-03, FLT-11
// Also needed by the requirements (not in the PDF tables, see docs/requirements/ASSUMED_REQUIREMENTS.md):
//   GET /api/countries     NEW-05, GEN-12
//   GET /api/cities        NEW-05, GEN-12   (filter by country)
//   GET /api/attractions   NEW-05, GEN-12   (filter by city)
//   GET /api/currencies    GEN-12, ACC-09, ITN-18   (supported currency list)
// Notes:
//   All public and read-only. Use the official ids from the datasets (EG, cairo, CAI, att-1).
//   Export lookups so other modules can reject unknown countries, cities and airports (NEW-05, FLT-02).
@ApiTags('Reference Data')
@Controller()
export class ReferenceDataController {
  constructor(private readonly referenceDataService: ReferenceDataService) {}

  // TODO: add the endpoints listed above.
}
