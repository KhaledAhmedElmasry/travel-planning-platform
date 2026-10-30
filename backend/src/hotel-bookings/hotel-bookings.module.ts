import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HotelsModule } from '../hotels/hotels.module';
import { PaymentsModule } from '../payments/payments.module';
import { HotelBookingLifecycleService } from './hotel-booking-lifecycle.service';
import { HotelBookingsController } from './hotel-bookings.controller';
import { HotelBookingsService } from './hotel-bookings.service';
import { RoomInventoryService } from './room-inventory.service';
import {
  HotelBooking,
  HotelBookingSchema,
} from './schemas/hotel-booking.schema';
import { RoomNight, RoomNightSchema } from './schemas/room-night.schema';

// PaymentsModule uses HotelBookingsService (payments for a reservation) and this module uses
// PaymentsService / RefundsService (expiry, cancellation): forwardRef on both sides.
// RoomInventoryService is exported for Area 7 (free rooms, room calendar, no block over a
// reservation); HotelsModule must import this module with forwardRef, since this one imports it.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HotelBooking.name, schema: HotelBookingSchema },
      { name: RoomNight.name, schema: RoomNightSchema },
    ]),
    HotelsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [HotelBookingsController],
  providers: [
    HotelBookingsService,
    HotelBookingLifecycleService,
    RoomInventoryService,
  ],
  exports: [HotelBookingsService, RoomInventoryService],
})
export class HotelBookingsModule {}
