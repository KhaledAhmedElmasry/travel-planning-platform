import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { AvailableRoomsQueryDto } from './dto/available-rooms-query.dto';
import { SearchHotelsQueryDto } from './dto/search-hotels-query.dto';
import { HotelSearchService } from './hotel-search.service';

// Area: Hotels & Rooms
// Public read endpoints for guests and travellers (no login):
//   GET /api/hotels/search                HTL-11
//   GET /api/hotels/:id/rooms/available   HTL-15
// Listed before HotelsController in hotels.module.ts, so /hotels/search is matched before
// GET /api/hotels/:id ("search" is not an id).
@Controller('hotels')
export class HotelSearchController {
  constructor(private readonly hotelSearch: HotelSearchService) {}

  // HTL-11: hotels with enough free rooms for the stay and the guests.
  @Get('search')
  search(@Query() query: SearchHotelsQueryDto) {
    return this.hotelSearch.search(query);
  }

  // HTL-15: the hotel's rooms that are free for every night of the stay, with the stay price.
  @Get(':id/rooms/available')
  listAvailableRooms(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: AvailableRoomsQueryDto,
  ) {
    return this.hotelSearch.listAvailableRooms(id, query);
  }
}
