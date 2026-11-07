import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { AvailableRoomsQueryDto } from './dto/available-rooms-query.dto';
import { HotelSearchService } from './hotel-search.service';

// Area: Hotels & Rooms
// Public read endpoints for guests and travellers (no login):
//   GET /api/hotels/:id/rooms/available   HTL-15
// Listed before HotelsController in hotels.module.ts, so these paths are matched before
// GET /api/hotels/:id.
@Controller('hotels')
export class HotelSearchController {
  constructor(private readonly hotelSearch: HotelSearchService) {}

  // HTL-15: the hotel's rooms that are free for every night of the stay, with the stay price.
  @Get(':id/rooms/available')
  listAvailableRooms(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: AvailableRoomsQueryDto,
  ) {
    return this.hotelSearch.listAvailableRooms(id, query);
  }
}
