import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReferenceDataService } from './reference-data.service';

// Owner: Member 1 (Team leader)
// Requirements: FLT-02, GEN-12, NEW-05
// Endpoints to implement (PDF section 8):
//   GET /api/airports   FLT-02, FLT-03, FLT-11
//   (plus countries / cities as needed, NEW-05)
@ApiTags('Reference Data')
@Controller()
export class ReferenceDataController {
  constructor(private readonly referenceDataService: ReferenceDataService) {}

  // TODO: add the endpoints listed above.
}
