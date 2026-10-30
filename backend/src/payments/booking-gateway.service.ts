import { Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { BookingType } from '../common/enums';
import { FlightBookingsService } from '../flight-bookings/flight-bookings.service';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';
import {
  BookingPaymentHandler,
  PayableBooking,
} from './interfaces/payable-booking.interface';

// Area: Payments & Refunds
// One place that picks the flight or hotel booking service for a booking type and checks that
// a booking belongs to the logged-in user. Used by payments (PAY-01) and policies (PAY-02).
@Injectable()
export class BookingGateway {
  constructor(
    private readonly flightBookings: FlightBookingsService,
    private readonly hotelBookings: HotelBookingsService,
  ) {}

  handlerFor(bookingType: BookingType): BookingPaymentHandler {
    return bookingType === BookingType.Flight
      ? this.flightBookings
      : this.hotelBookings;
  }

  // Another user's booking is reported as not found (ACC-11).
  async findOwnedBooking(
    userId: string,
    bookingType: BookingType,
    bookingId: string,
  ): Promise<PayableBooking> {
    const booking = isValidObjectId(bookingId)
      ? await this.handlerFor(bookingType).findPayableBooking(bookingId)
      : null;
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found.');
    }
    return booking;
  }
}
