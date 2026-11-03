import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { Room, RoomSchema } from './schemas/room.schema';

@Module({
  imports: [
    // The "Hotel" and "Room" models (collections "hotels" and "rooms"), as agreed with Area 1.
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService], // Area 6 reuses the hotel search service (HTL-11)
})
export class HotelsModule {}
