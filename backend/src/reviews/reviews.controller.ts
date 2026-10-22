import { Controller } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

// Area: Hotel Booking & Reviews
// Requirements: HTL-23, HTL-24
// Endpoints to implement (PDF section 8):
//   POST   /api/hotel-bookings/:id/review   HTL-23
//   PATCH  /api/reviews/:id                 HTL-23
//   DELETE /api/reviews/:id                 HTL-23
//   GET    /api/hotels/:id/reviews          HTL-24
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   POST /api/reviews/:id/reply   HTL-26 (Optional)
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // TODO: add the endpoints listed above.
}
