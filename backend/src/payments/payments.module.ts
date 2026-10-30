import { Module } from '@nestjs/common';
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

// TODO(NEW-01, FLT-26, HTL-21, FLT-06): the booking modules (hold-expiry cron, cancellations)
// and FlightsModule (airline cancels a flight) need PaymentsService / RefundsService, while
// PaymentsModule already imports the booking modules. Use forwardRef(() => ...) on both sides
// (NestJS circular module dependency) when that code is added.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
    ]),
    FlightBookingsModule,
    HotelBookingsModule,
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
