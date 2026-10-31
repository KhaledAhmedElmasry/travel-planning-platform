import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { Hotel, HotelSchema } from './schemas/hotel.schema';

@Module({
  imports: [
    // Registers the "Hotel" model (collection "hotels"), as agreed with Area 1.
    MongooseModule.forFeature([{ name: Hotel.name, schema: HotelSchema }]),
  ],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService], // Area 6 reuses the hotel search service (HTL-11)
})
export class HotelsModule {}
