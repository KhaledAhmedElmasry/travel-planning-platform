import { Controller } from '@nestjs/common';
import { HotelsService } from './hotels.service';

// Area: Hotels & Rooms
// Requirements: HTL-01..HTL-06, HTL-08..HTL-12, HTL-15, HTL-22
// Endpoints to implement (PDF section 8):
//   POST   /api/hotels                                  HTL-01
//   GET    /api/hotels/search                           HTL-11, HTL-12
//   GET    /api/hotels/:id                              HTL-02
//   PATCH  /api/hotels/:id                              HTL-01
//   POST   /api/hotels/:id/rooms                        HTL-03
//   PATCH  /api/hotels/:id/rooms/:roomId                HTL-05
//   DELETE /api/hotels/:id/rooms/:roomId                HTL-06
//   GET    /api/hotels/:id/rooms/available              HTL-15
//   POST   /api/hotels/:id/rooms/:roomId/availability   HTL-04
//   PATCH  /api/hotels/:id/rooms/:roomId/availability   HTL-05, HTL-06
//   GET    /api/hotels/:id/availability                 HTL-08
//   PUT    /api/hotels/:id/policies                     HTL-08, HTL-10
//   GET    /api/hotels/:id/reservations                 HTL-22
// Notes:
//   The policies endpoint (PUT /api/hotels/:id/policies) also sets check-in / check-out times (HTL-09).
//   Photos are sent as multipart/form-data on POST /api/hotels and PATCH /api/hotels/:id; PATCH takes
//   removePhotoIds (HTL-01, GEN-08: up to 5 per hotel). There is no separate upload endpoint.
//   A room is deactivated through PATCH /api/hotels/:id/rooms/:roomId with active: false (HTL-06).
//   Admins create hotels; only the moderator assigned to THIS hotel may edit it (ACC-11, ACC-13).
//   Deactivated hotels (ACC-15) and deactivated rooms (HTL-06) are excluded from search.
//   Hotel search must be reusable from itineraries (ITN-25): keep it in the exported service.
//   Declare /hotels/search before /hotels/:id so "search" is not matched as an id.
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  // TODO: add the endpoints listed above.
}
