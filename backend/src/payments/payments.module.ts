import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { BookingGateway } from './booking-gateway.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PoliciesService } from './policies.service';
import { RefundsService } from './refunds.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Refund, RefundSchema } from './schemas/refund.schema';
import { stripeProvider } from './stripe.provider';

// FlightBookingsModule and HotelBookingsModule (hold expiry, FLT-26 / HTL-21 cancellation) use
// PaymentsService / RefundsService while this module uses their booking services: forwardRef on
// both sides (circular modules).
// FLT-06 (Area 5) does not need this module: the flight cancellation calls
// FlightBookingLifecycleService.cancelBookingsForFlight() / finishFlightCancellation(), so
// FlightsModule imports FlightBookingsModule.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
    ]),
    forwardRef(() => FlightBookingsModule),
    forwardRef(() => HotelBookingsModule),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PoliciesService,
    RefundsService,
    BookingGateway,
    stripeProvider,
  ],
  exports: [PaymentsService, RefundsService],
})
export class PaymentsModule {}
