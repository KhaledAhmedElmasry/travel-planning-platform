import { Controller, Get, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ReferenceDataService } from './reference-data.service';

// Area: Reference Data & Seeding
// Requirements: FLT-02, GEN-12, NEW-05
// Endpoints to implement (PDF section 8):
//   GET /api/airports   FLT-03, FLT-11
// Extra endpoints (not in the PDF tables, documented in docs/api/openapi.yaml):
//   GET /api/currencies   GEN-12 (supported currency list, also used by ACC-09 and ITN-18)
// Extra endpoints may still be needed for:
//   reading countries, cities and attractions (NEW-05)
// Notes:
//   The airports endpoint returns the predefined, read-only airport list (FLT-02).
//   All public and read-only. Use the official ids from the datasets (EG, cairo, CAI, att-1).
//   Export lookups so other modules can reject unknown countries, cities and airports (NEW-05, FLT-02).
@Controller()
export class ReferenceDataController {
  constructor(private readonly referenceDataService: ReferenceDataService) {}

  // GEN-12: the supported currency list. Public, read-only.
  @Get('currencies')
  listCurrencies(@Query() query: PaginationQueryDto) {
    return this.referenceDataService.listCurrencies(query);
  }
}
