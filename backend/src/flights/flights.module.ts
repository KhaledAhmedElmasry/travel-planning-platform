// Requirements: FLT-11, GEN-02, GEN-04, GEN-05, GEN-06, GEN-13.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightSearchController } from './flight-search.controller';
import { FlightSearchService } from './flight-search.service';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
// TODO(AREA-5): Replace these placeholder model imports with the merged Area 5 schema exports.
import { Airline, AirlineSchema } from './placeholders/airline.schema';
import { Airport, AirportSchema } from './placeholders/airport.schema';
import { Flight, FlightSchema } from './placeholders/flight.schema';
import {
  PlaceholderSeatReservationProvider,
  SEAT_RESERVATION_PROVIDER,
} from './placeholders/seat-reservation-provider.placeholder';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Airport.name, schema: AirportSchema },
      { name: Airline.name, schema: AirlineSchema },
      { name: Flight.name, schema: FlightSchema },
    ]),
  ],
  // Keep the literal /search route before FlightsController's future /:id route.
  controllers: [FlightSearchController, FlightsController],
  providers: [
    FlightsService,
    FlightSearchService,
    // TODO(AREA-1): Replace this provider class with Area 1's batched reservation provider.
    {
      provide: SEAT_RESERVATION_PROVIDER,
      useClass: PlaceholderSeatReservationProvider,
    },
  ],
  exports: [FlightsService, FlightSearchService],
})
export class FlightsModule {}
