import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirlinesModule } from '../airlines/airlines.module';
import { PaymentsModule } from '../payments/payments.module';
import { FlightBookingQuoteService } from './booking-quote.service';
import { FlightBookingLifecycleService } from './flight-booking-lifecycle.service';
import { FlightBookingsController } from './flight-bookings.controller';
import { FlightBookingsService } from './flight-bookings.service';
import {
  FlightBooking,
  FlightBookingSchema,
} from './schemas/flight-booking.schema';
import { SeatInventoryService } from './seat-inventory.service';

// PaymentsModule uses FlightBookingsService (payments for a booking) and this module uses
// PaymentsService / RefundsService (expiry, cancellation): forwardRef on both sides.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FlightBooking.name, schema: FlightBookingSchema },
    ]),
    AirlinesModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [FlightBookingsController],
  providers: [
    FlightBookingsService,
    FlightBookingLifecycleService,
    FlightBookingQuoteService,
    SeatInventoryService,
  ],
  exports: [FlightBookingsService, SeatInventoryService],
})
export class FlightBookingsModule {}
