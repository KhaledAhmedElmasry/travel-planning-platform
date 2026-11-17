// Area: Itineraries
// Used by: GET /api/itineraries (query)
// Requirements: ITN-03, GEN-05
//
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Query parameters accepted by GET /api/itineraries. */
export class ListItinerariesQueryDto extends PaginationQueryDto {}
