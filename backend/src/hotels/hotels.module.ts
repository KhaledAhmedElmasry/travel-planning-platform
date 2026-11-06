import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
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
    // RoomInventoryService: which nights are reserved (HTL-05, HTL-06). forwardRef because
    // HotelBookingsModule imports this module.
    forwardRef(() => HotelBookingsModule),
  ],
  controllers: [HotelsController, RoomsController],
  providers: [HotelsService, RoomsService],
  exports: [HotelsService], // Area 6 reuses the hotel search service (HTL-11)
})
export class HotelsModule {}
