import { Controller } from '@nestjs/common';
import { AirlinesService } from './airlines.service';

// Area: Airlines & Flight Inventory
// Requirements: FLT-01, FLT-04, FLT-08, FLT-09
// Endpoints to implement (PDF section 8):
//   POST  /api/airlines                           FLT-01
//   GET   /api/airlines/:id                       FLT-01
//   PATCH /api/airlines/:id                       FLT-01
//   PUT   /api/airlines/:id/baggage-policy        FLT-04, FLT-08
//   PUT   /api/airlines/:id/cancellation-policy   FLT-09
// Notes:
//   The logo is sent as multipart/form-data on POST /api/airlines and PATCH /api/airlines/:id
//   (FLT-01, GEN-08: 1 logo per airline), as in openapi.yaml; there is no separate upload endpoint.
//   Admins create airlines; only the moderator assigned to THIS airline may edit it (ACC-11, ACC-13).
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  // TODO: add the endpoints listed above.
}
