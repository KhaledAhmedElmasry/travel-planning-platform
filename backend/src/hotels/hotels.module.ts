import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { HotelSearchController } from './hotel-search.controller';
import { HotelSearchService } from './hotel-search.service';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { Room, RoomSchema } from './schemas/room.schema';

@Module({
  imports: [
    // The "Hotel" and "Room" models (collections "hotels" and "rooms"), as agreed with Area 1.
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    // RoomInventoryService: which nights are reserved (HTL-05, HTL-06, HTL-15). forwardRef because
    // HotelBookingsModule imports this module.
    forwardRef(() => HotelBookingsModule),
  ],
  // HotelSearchController first: its fixed paths (search, rooms/available) are matched before
  // HotelsController's /hotels/:id.
  controllers: [HotelSearchController, HotelsController, RoomsController],
  providers: [HotelsService, RoomsService, HotelSearchService],
  // Area 6 reuses the hotel search (HotelSearchService, HTL-11, ITN-25).
  exports: [HotelsService, HotelSearchService],
})
export class HotelsModule {}
