import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service';

// Area: Community & Cross-cutting
// Requirements: BLG-01..BLG-12
// Endpoints to implement (PDF section 8):
//   POST   /api/posts                         BLG-01
//   GET    /api/posts                         BLG-02, BLG-09, BLG-11
//   GET    /api/posts/:id                     BLG-02
//   GET    /api/posts/mine                    BLG-03
//   PATCH  /api/posts/:id                     BLG-04, BLG-08
//   DELETE /api/posts/:id                     BLG-04
//   POST   /api/posts/:id/comments            BLG-05
//   PATCH  /api/comments/:id                  BLG-07
//   DELETE /api/comments/:id                  BLG-07
//   POST   /api/posts/:id/like                BLG-06
//   DELETE /api/posts/:id/like                BLG-06
//   POST   /api/posts/:id/images              BLG-10, GEN-08
//   DELETE /api/posts/:id/images/:imageId     BLG-10
//   GET    /api/tags/:tag/posts               BLG-08, BLG-11
//   GET    /api/authors/:id                   BLG-12
// Notes:
//   Declare /posts/mine before /posts/:id so "mine" is not matched as an id.
//   Hidden content (GEN-10) and content of deactivated authors (ACC-12) is not shown publicly.
// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Bonus endpoints:
//   PATCH /api/posts/:id/itinerary   BLG-13 (Optional)
@ApiTags('Blog')
@Controller()
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // TODO: add the endpoints listed above.
}
