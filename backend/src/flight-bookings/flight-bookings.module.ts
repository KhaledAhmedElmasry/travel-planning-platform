import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirlinesModule } from '../airlines/airlines.module';
import { Airline, AirlineSchema } from '../airlines/schemas/airline.schema';
import { Flight, FlightSchema } from '../flights/schemas/flight.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { FlightBookingQuoteService } from './booking-quote.service';
import { FlightBookingLifecycleService } from './flight-booking-lifecycle.service';
import { FlightBookingsController } from './flight-bookings.controller';
import { FlightBookingsService } from './flight-bookings.service';
import { FlightSeatSelectionService } from './flight-seat-selection.service';
import {
  FlightBooking,
  FlightBookingSchema,
} from './schemas/flight-booking.schema';
import { SeatInventoryService } from './seat-inventory.service';

// PaymentsModule uses FlightBookingsService (payments for a booking) and this module uses
// PaymentsService / RefundsService (expiry, cancellation): forwardRef on both sides.
// FlightBookingLifecycleService is exported for Area 5 (FLT-06: cancelBookingsForFlight() and
// finishFlightCancellation()); FlightsModule imports this module. This module imports
// AirlinesModule, so if AirlinesModule ever imports FlightsModule, use forwardRef on that loop.
// FlightBookingsService is exported for Area 2 (ACC-12: hasUpcomingBookings()).
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FlightBooking.name, schema: FlightBookingSchema },
      { name: Flight.name, schema: FlightSchema },
      { name: Airline.name, schema: AirlineSchema },
    ]),
    AirlinesModule,
    forwardRef(() => PaymentsModule),
    NotificationsModule,
  ],
  controllers: [FlightBookingsController],
  providers: [
    FlightBookingsService,
    FlightBookingLifecycleService,
    FlightBookingQuoteService,
    FlightSeatSelectionService,
    SeatInventoryService,
  ],
  exports: [
    FlightBookingsService,
    FlightBookingLifecycleService,
    FlightSeatSelectionService,
    SeatInventoryService,
  ],
})
export class FlightBookingsModule {}
