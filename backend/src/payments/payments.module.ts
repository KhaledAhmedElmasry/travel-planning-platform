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

// FlightBookingsModule (hold expiry, FLT-26 cancellation) uses PaymentsService / RefundsService
// while this module uses FlightBookingsService: forwardRef on both sides (circular modules).
// TODO(HTL-18, HTL-21; FLT-06 Area 5): do the same for HotelBookingsModule and FlightsModule
// when their expiry / cancellation code needs PaymentsService or RefundsService.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
    ]),
    forwardRef(() => FlightBookingsModule),
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
