import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus, BookingType } from '../common/enums';
import { ItineraryBookingsService } from './itinerary-bookings.service';

// ITN-27 (bonus): a Confirmed or a Completed booking (a past trip) can be linked to an itinerary
// day; a booking that is not booked (pending payment, expired, cancelled) cannot.

const itineraryId = new Types.ObjectId('665f1c2a9b1e8a00123400a1');
const userId = '665f1c2a9b1e8a0012345678';
const dto = {
  bookingType: BookingType.Hotel,
  bookingId: '665f1c2a9b1e8a00123400c1',
  dayId: '665f1c2a9b1e8a0012345680',
};
const NOT_LINKABLE =
  'The booking is not Confirmed or Completed, or it is already linked.';

function makeService(status: BookingStatus) {
  const booking = {
    _id: new Types.ObjectId(dto.bookingId),
    userId: new Types.ObjectId(userId),
    status,
    reference: 'H7K2QX',
    totalAmount: 45000,
    currency: 'USD',
    hotelName: 'Nile View',
    checkIn: new Date('2026-10-01T00:00:00.000Z'),
    checkOut: new Date('2026-10-04T00:00:00.000Z'),
  };
  const insertOne = jest.fn().mockResolvedValue({});
  const collection = jest.fn((name: string) =>
    name === 'itinerary_booking_links'
      ? { insertOne }
      : { findOne: jest.fn().mockResolvedValue(booking) },
  );
  const service = new ItineraryBookingsService({ collection } as never);
  return { service, insertOne };
}

describe('ItineraryBookingsService.link (ITN-27)', () => {
  it.each([BookingStatus.Confirmed, BookingStatus.Completed])(
    'links a %s booking',
    async (status) => {
      const { service, insertOne } = makeService(status);

      const link = await service.link(itineraryId, userId, dto);

      expect(insertOne).toHaveBeenCalledTimes(1);
      expect(link).toMatchObject({
        bookingType: 'hotel',
        bookingId: dto.bookingId,
        dayId: dto.dayId,
        amount: 450,
        currency: 'USD',
        status,
      });
    },
  );

  it.each([
    BookingStatus.PendingPayment,
    BookingStatus.Expired,
    BookingStatus.Cancelled,
  ])('refuses a %s booking with 409', async (status) => {
    const { service, insertOne } = makeService(status);

    const call = service.link(itineraryId, userId, dto);
    await expect(call).rejects.toBeInstanceOf(ConflictException);
    await expect(call).rejects.toThrow(NOT_LINKABLE);
    expect(insertOne).not.toHaveBeenCalled();
  });
});
