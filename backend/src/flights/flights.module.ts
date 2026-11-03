import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightDetailsController } from './flight-details.controller';
import { FlightDetailsService } from './flight-details.service';
import { FlightSearchController } from './flight-search.controller';
import { FlightSearchService } from './flight-search.service';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Airline, AirlineSchema } from './placeholders/airline.schema';
import { Airport, AirportSchema } from './placeholders/airport.schema';
import { Flight, FlightSchema } from './schemas/flight.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Airport.name, schema: AirportSchema },
      { name: Airline.name, schema: AirlineSchema },
      { name: Flight.name, schema: FlightSchema },
    ]),
  ],
  controllers: [
    FlightSearchController,
    // Keep details after search so /flights/search is never interpreted as an ObjectId.
    FlightDetailsController,
    FlightsController,
  ],
  providers: [FlightsService, FlightSearchService, FlightDetailsService],
  exports: [FlightsService, FlightSearchService, FlightDetailsService],
})
export class FlightsModule {}
