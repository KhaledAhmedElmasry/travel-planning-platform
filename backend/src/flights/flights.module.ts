import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightSearchController } from './flight-search.controller';
import { FlightSearchService } from './flight-search.service';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
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
  controllers: [FlightSearchController, FlightsController],
  providers: [
    FlightsService,
    FlightSearchService,
    {
      provide: SEAT_RESERVATION_PROVIDER,
      useClass: PlaceholderSeatReservationProvider,
    },
  ],
  exports: [FlightsService, FlightSearchService],
})
export class FlightsModule {}
