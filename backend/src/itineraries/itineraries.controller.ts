import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ItinerariesService } from './itineraries.service';

// Owner: Member 8 (Itineraries)
// Requirements: ITN-01..ITN-26
// Endpoints to implement (PDF section 8):
//   POST   /api/itineraries                                ITN-01
//   GET    /api/itineraries                                ITN-03
//   GET    /api/itineraries/:id                            ITN-03
//   PATCH  /api/itineraries/:id                            ITN-01, ITN-20
//   DELETE /api/itineraries/:id                            ITN-01
//   POST   /api/itineraries/:id/days                       ITN-05
//   PATCH  /api/itineraries/:id/days/:dayId                ITN-05
//   DELETE /api/itineraries/:id/days/:dayId                ITN-07
//   PATCH  /api/itineraries/:id/days/reorder               ITN-08
//   POST   /api/itineraries/:id/days/:dayId/activities     ITN-10
//   PATCH  /api/activities/:id                             ITN-10
//   DELETE /api/activities/:id                             ITN-10
//   POST   /api/activities/:id/images                      ITN-12, GEN-08
//   DELETE /api/activities/:id/images/:imageId             ITN-12
//   POST   /api/itineraries/:id/days/:dayId/budgets        ITN-14
//   PATCH  /api/budgets/:id                                ITN-14
//   DELETE /api/budgets/:id                                ITN-14
//   POST   /api/itineraries/:id/transport-costs            ITN-16
//   PATCH  /api/transport-costs/:id                        ITN-16
//   DELETE /api/transport-costs/:id                        ITN-16
//   GET    /api/itineraries/:id/budget-summary             ITN-14, ITN-18
//   GET    /api/itineraries/public/search                  ITN-20, ITN-21
//   GET    /api/itineraries/public/:id                     ITN-21
//   POST   /api/itineraries/:id/clone                      ITN-21
//   GET    /api/itineraries/:id/hotels                     ITN-09, ITN-25
//   GET    /api/itineraries/:id/flights                    ITN-26
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   POST /api/itineraries/:id/bookings   ITN-27 (Optional)
//   GET  /api/itineraries/:id/pdf        ITN-28 (Optional)
@ApiTags('Itineraries')
@Controller()
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  // TODO: add the endpoints listed above.
}
