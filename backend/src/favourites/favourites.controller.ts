import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FavouritesService } from './favourites.service';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Hotels & Rooms (bonus)
// Requirements: BON-02
// Endpoints to implement:
//   add, remove and list the user's favourite hotels and public itineraries   BON-02
@ApiTags('Favourites')
@Controller('favourites')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  // TODO: add the endpoints listed above.
}
