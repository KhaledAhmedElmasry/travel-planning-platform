// Area: Itineraries
// Used by: GET /api/itineraries/public/search (query)
// Requirements: ITN-20, GEN-05
//
// ITN-21 adds keyword and itinerary-detail filters; this endpoint currently accepts pagination
// only and returns every non-hidden public itinerary.

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Query parameters accepted by the guest-accessible public itinerary list. */
export class SearchPublicItinerariesQueryDto extends PaginationQueryDto {}
