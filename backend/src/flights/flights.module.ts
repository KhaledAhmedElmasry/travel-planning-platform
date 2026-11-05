import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirlinesModule } from '../airlines/airlines.module';
import { Airline, AirlineSchema } from '../airlines/schemas/airline.schema';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import {
  FlightBooking,
  FlightBookingSchema,
} from '../flight-bookings/schemas/flight-booking.schema';
import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { FlightDetailsController } from './flight-details.controller';
import { FlightDetailsService } from './flight-details.service';
import { FlightSearchController } from './flight-search.controller';
import { FlightSearchService } from './flight-search.service';
import { FlightStatusJob } from './flight-status.job';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Flight, FlightSchema } from './schemas/flight.schema';

// Area: Airlines & Flight Inventory (+ Flight Search & Booking: search FLT-11/12/15, details FLT-17)
// FlightSearchController is listed first so /flights/search is not matched as /flights/:id.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Flight.name, schema: FlightSchema },
      // FLT-05, NEW-02: the bookings' copy of the flight times (Area 1's schema, read and
      // updated here only for that).
      { name: FlightBooking.name, schema: FlightBookingSchema },
      // FLT-11, FLT-17: read-only, the airline of each flight (active, name, policies).
      { name: Airline.name, schema: AirlineSchema },
    ]),
    AirlinesModule, // the moderator's airline (FLT-03)
    ReferenceDataModule, // the airport lookup (FLT-02)
    // FlightBookingLifecycleService (Area 1): the bookings of a cancelled flight (FLT-06, NEW-02).
    // FlightBookingsModule does not import FlightsModule, so no forwardRef is needed.
    FlightBookingsModule,
  ],
  controllers: [
    FlightSearchController,
    FlightDetailsController,
    FlightsController,
  ],
  providers: [
    FlightsService,
    FlightStatusJob, // FLT-30
    FlightSearchService,
    FlightDetailsService,
  ],
  exports: [FlightsService],
})
export class FlightsModule {}
