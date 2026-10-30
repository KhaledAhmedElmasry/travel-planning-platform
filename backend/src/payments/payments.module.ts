import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightBookingsModule } from '../flight-bookings/flight-bookings.module';
import { HotelBookingsModule } from '../hotel-bookings/hotel-bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { stripeProvider } from './stripe.provider';

// TODO(PAY-03): register the Refund schema here too.
// TODO(NEW-01): the booking modules' hold-expiry cron needs PaymentsService.cancelPaymentForBooking,
// and PaymentsModule already imports the booking modules. Use forwardRef(() => ...) on both sides
// (NestJS circular module dependency) when that cron is added.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    FlightBookingsModule,
    HotelBookingsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, stripeProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
