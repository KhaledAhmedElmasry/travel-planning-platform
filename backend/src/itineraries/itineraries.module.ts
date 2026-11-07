import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { HotelsModule } from '../hotels/hotels.module';
import { FlightsModule } from '../flights/flights.module';

@Module({
  imports: [
    UploadsModule,
    UsersModule,
    ExchangeRatesModule,
    HotelsModule,
    FlightsModule,
    MongooseModule.forFeature([
      { name: Itinerary.name, schema: ItinerarySchema },
    ]),
  ],
  controllers: [ItinerariesController],
  providers: [ItinerariesService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
