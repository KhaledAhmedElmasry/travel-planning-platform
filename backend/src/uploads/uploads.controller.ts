import { Controller } from '@nestjs/common';
import { UploadsService } from './uploads.service';

// Area: Community & Cross-cutting
// Requirements: GEN-08
// Endpoints to implement (PDF section 8):
//   (upload endpoints live in the modules that own the images)
@Controller()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // TODO: add the endpoints listed above.
}
