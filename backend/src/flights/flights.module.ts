import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirlinesModule } from '../airlines/airlines.module';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { FlightSearchController } from './flight-search.controller';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Flight, FlightSchema } from './schemas/flight.schema';

// Area: Airlines & Flight Inventory
// FlightSearchController is listed first so /flights/search is not matched as /flights/:id.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Flight.name, schema: FlightSchema }]),
    AirlinesModule, // the moderator's airline (FLT-03)
    ReferenceDataModule, // the airport lookup (FLT-02)
  ],
  controllers: [FlightSearchController, FlightsController],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}
