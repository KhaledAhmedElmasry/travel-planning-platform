import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  ClientSession,
  Connection,
  FilterQuery,
  isValidObjectId,
  Model,
  Types,
} from 'mongoose';
import { BookingStatus, BookingType } from '../common/enums';
import { allowedFrom } from '../payments/booking-lifecycle';
import { HotelsService } from '../hotels/hotels.service';
import {
  newReference,
  REFERENCE_ATTEMPTS,
} from '../payments/booking-reference';
import type {
  BookingPaymentHandler,
  BookingPolicies,
  ConfirmPaidBookingResult,
  PayableBooking,
} from '../payments/interfaces/payable-booking.interface';
import { isDuplicateKeyError } from '../payments/is-duplicate-key-error';
import { platformCurrency } from '../payments/platform-currency';
import {
  CreateHotelBookingDto,
  RoomGuestsDto,
} from './dto/create-hotel-booking.dto';
import { RoomInventoryService } from './room-inventory.service';
import {
  BookedRoom,
  HotelBooking,
  HotelBookingDocument,
} from './schemas/hotel-booking.schema';
import { dateOnly, formatDate, stayNights, todayUtc } from './stay-dates';

// Area: Payments, Holds & Booking Engine (HTL-16, HTL-17, HTL-18) and Search & My Bookings
// (HTL-20)
// Business logic and database access for: HTL-16, HTL-17, HTL-18, HTL-20, HTL-21, GEN-11, NEW-01
//
// Done here (Area 1): booking one or more rooms with their guests and the 10-minute hold of all
// of them together (HTL-16, HTL-18), the four BookingPaymentHandler methods used by the payments
// module (PAY-01, PAY-02) and confirmation with the booking reference (HTL-17). The hold-expiry
// job and cancellation (HTL-21) are in hotel-booking-lifecycle.service.ts.
// The hotels and rooms are Area 7's documents, read with the field names agreed in
// hotels/schemas/hotel.schema.ts and room.schema.ts.
// WAITING FOR: HotelsService.getBookingPolicies() (Area 7, HTL-09, HTL-10); until then
// GET /api/bookings/hotel/:id/policies answers 501 (accepting them and paying work).
// TODO(GEN-01, Area 3): notify the user on confirmation (see tryConfirm).
// TODO(HTL-20; Area 6): the list and the details go here too. The details must include
// RefundsService.findRefundForBooking() and the refund preview (HTL-21):
// HotelBookingLifecycleService.previewCancellation(booking), the same function the cancellation
// uses. For the Upcoming group of the list use upcomingHotelBookings() below (NEW-01).

// HTL-18: all rooms are held together for 10 minutes.
export const HOLD_MINUTES = 10;

// NEW-01 "upcoming" (ACC-12, Area 2; the Upcoming group of HTL-20, Area 6): Confirmed, with a
// check-in date still in the future (UTC), i.e. a stay not yet started; it can still be cancelled
// (HTL-21). A stay in progress is not upcoming any more and becomes Completed the day after its
// check-out date (completeStays).
export function upcomingHotelBookings(
  now = new Date(),
): FilterQuery<HotelBooking> {
  return {
    status: BookingStatus.Confirmed,
    checkIn: { $gt: todayUtc(now) },
  };
}

const HOTELS_COLLECTION = 'hotels';
const ROOMS_COLLECTION = 'rooms';

// The fields read from Area 7's documents (agreed names, see hotels/schemas/*.schema.ts).
interface HotelDoc {
  _id: Types.ObjectId;
  name: string;
  active?: boolean;
}

interface DateRange {
  from: Date | string;
  to: Date | string;
}

interface RoomDoc {
  _id: Types.ObjectId;
  hotelId: Types.ObjectId | string;
  roomNumber: string;
  type: string;
  beds: number;
  maxOccupancy: number;
  pricePerNight: number;
  active?: boolean;
  availableRanges?: DateRange[];
  blockedRanges?: DateRange[];
}

export interface HotelBookingResponse {
  id: string;
  reference: string | null;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  hotel: { id: string; name: string };
  // YYYY-MM-DD; checkOut is the departure day.
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: {
    roomId: string;
    roomNumber: string;
    type: string;
    beds: number;
    maxOccupancy: number;
    adults: number;
    childrenAges: number[];
    pricePerNight: number;
    subtotal: number;
  }[];
  guests: { adults: number; children: number };
  totalAmount: number;
  currency: string;
  policiesAcceptedAt: Date | null;
  paymentId: string | null;
  confirmedAt: Date | null;
  expiredAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt?: Date;
}

@Injectable()
export class HotelBookingsService implements BookingPaymentHandler {
  private readonly logger = new Logger(HotelBookingsService.name);

  constructor(
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
    @InjectConnection() private readonly connection: Connection,
    private readonly inventory: RoomInventoryService,
    private readonly hotelsService: HotelsService,
    private readonly config: ConfigService,
  ) {}

  // POST /api/hotel-bookings (HTL-16, HTL-18): check the request, then in ONE transaction read the
  // hotel and rooms, create the reservation and hold every night of every room. If any room or
  // night is not available, everything is undone and nothing is held.
  async book(
    userId: string,
    request: CreateHotelBookingDto,
  ): Promise<HotelBookingResponse> {
    const checkIn = dateOnly(request.checkIn);
    const checkOut = dateOnly(request.checkOut);
    checkStayDates(checkIn, checkOut);
    checkGuests(request.rooms);
    const nights = stayNights(checkIn, checkOut);

    const created: { booking: HotelBookingDocument | null } = {
      booking: null,
    };
    try {
      await this.connection.transaction(async (session) => {
        const now = new Date();
        const hotel = await this.hotels().findOne(
          { _id: new Types.ObjectId(request.hotelId) },
          { session },
        );
        // A deactivated hotel cannot be booked (ACC-15).
        if (!hotel || hotel.active === false) {
          throw new NotFoundException('Hotel not found.');
        }
        const rooms = await this.loadRooms(hotel, request.rooms, session);
        checkAvailability(rooms, nights);

        // Writing each room makes a room change saved at the same moment (block, deactivation,
        // availability; Area 7) conflict with this hold, so one of them retries and sees the
        // other (see hotels/schemas/room.schema.ts).
        await this.rooms().updateMany(
          { _id: { $in: rooms.map((r) => r._id) } },
          { $set: { lastReservedAt: now } },
          { session },
        );

        const holdExpiresAt = new Date(
          now.getTime() + HOLD_MINUTES * 60 * 1000,
        );
        const bookedRooms: BookedRoom[] = request.rooms.map((guests, i) => ({
          roomId: rooms[i]._id,
          roomNumber: rooms[i].roomNumber,
          type: rooms[i].type,
          beds: rooms[i].beds,
          maxOccupancy: rooms[i].maxOccupancy,
          adults: guests.adults,
          childrenAges: guests.childrenAges ?? [],
          pricePerNight: rooms[i].pricePerNight,
          // HTL-16: nights x the room's price at booking time.
          subtotal: nights.length * rooms[i].pricePerNight,
        }));
        const [booking] = await this.bookingModel.create(
          [
            {
              userId,
              hotelId: hotel._id,
              hotelName: hotel.name,
              checkIn,
              checkOut,
              nights: nights.length,
              rooms: bookedRooms,
              totalAmount: bookedRooms.reduce((sum, r) => sum + r.subtotal, 0),
              currency: platformCurrency(this.config),
              status: BookingStatus.PendingPayment,
              holdExpiresAt,
            },
          ],
          { session },
        );
        await this.inventory.hold(
          {
            bookingId: booking._id,
            hotelId: hotel._id,
            roomIds: rooms.map((r) => r._id),
            nights,
            expiresAt: holdExpiresAt,
            now,
          },
          session,
        );
        created.booking = booking;
      });
    } catch (err) {
      // A room-night is already held or booked by someone else (unique index, HTL-18).
      if (isDuplicateKeyError(err)) {
        throw new ConflictException(
          'At least one room is already reserved for these dates, so nothing was held.',
        );
      }
      throw err;
    }
    if (!created.booking) throw new Error('The reservation was not created.');
    return this.toResponse(created.booking);
  }

  // The owner's reservation, otherwise 404 (ACC-11).
  async findOwned(
    userId: string,
    bookingId: string,
  ): Promise<HotelBookingDocument> {
    const booking = isValidObjectId(bookingId)
      ? await this.bookingModel.findOne({ _id: bookingId, userId })
      : null;
    if (!booking) throw new NotFoundException('Reservation not found.');
    return booking;
  }

  // ACC-12 (Area 2): deactivating an account is blocked while the user has an upcoming hotel
  // reservation (NEW-01, see upcomingHotelBookings()).
  async hasUpcomingBookings(
    userId: string,
    now = new Date(),
  ): Promise<boolean> {
    if (!isValidObjectId(userId)) return false;
    const found = await this.bookingModel.exists({
      userId,
      ...upcomingHotelBookings(now),
    });
    return found !== null;
  }

  // --- Used by the payments module (PAY-01, PAY-02) ---

  async findPayableBooking(bookingId: string): Promise<PayableBooking | null> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) return null;
    return {
      id: booking._id.toString(),
      userId: booking.userId.toString(),
      status: booking.status,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
      policiesAcceptedAt: booking.policiesAcceptedAt,
    };
  }

  // PAY-02: one atomic update, so a hold that expires at the same moment cannot be accepted.
  async recordPolicyAcceptance(
    bookingId: string,
    acceptedAt: Date,
  ): Promise<boolean> {
    const result = await this.bookingModel.updateOne(
      {
        _id: bookingId,
        status: BookingStatus.PendingPayment,
        holdExpiresAt: { $gt: acceptedAt },
        policiesAcceptedAt: null,
      },
      { $set: { policiesAcceptedAt: acceptedAt } },
    );
    return result.modifiedCount === 1;
  }

  // PAY-02: the hotel's cancellation tiers and check-in/check-out times (Area 7).
  async getBookingPolicies(bookingId: string): Promise<BookingPolicies | null> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) return null;
    const hotel = await this.hotelsService.getBookingPolicies(
      booking.hotelId.toString(),
    );
    if (!hotel) return null;
    return {
      bookingType: BookingType.Hotel,
      hotel: { id: hotel.hotelId, name: hotel.name },
      cancellationTiers: [...hotel.cancellationTiers].sort(
        (a, b) => b.daysBefore - a.daysBefore,
      ),
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
    };
  }

  // HTL-17, called only by the verified Stripe webhook. In one transaction: pending_payment ->
  // confirmed with a unique reference (all rooms together), and the held room-nights -> booked.
  // A hold that has expired can never be confirmed (NEW-01): the payment is then refunded by
  // PaymentsService.
  async confirmPaidBooking(
    bookingId: string,
    paymentId: string,
  ): Promise<ConfirmPaidBookingResult> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.tryConfirm(bookingId, paymentId);
      } catch (err) {
        // Another reservation already has this reference (very rare): try a new one.
        if (isDuplicateKeyError(err) && attempt < REFERENCE_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  private async tryConfirm(
    bookingId: string,
    paymentId: string,
  ): Promise<ConfirmPaidBookingResult> {
    const outcome: { result: ConfirmPaidBookingResult } = {
      result: 'not_confirmable',
    };
    await this.connection.transaction(async (session) => {
      const now = new Date();
      const booking = await this.bookingModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: { $in: allowedFrom(BookingStatus.Confirmed) },
          holdExpiresAt: { $gt: now },
        },
        {
          $set: {
            status: BookingStatus.Confirmed,
            confirmedAt: now,
            paymentId: new Types.ObjectId(paymentId),
            reference: newReference(),
          },
        },
        { new: true, session },
      );

      if (!booking) {
        // Stripe can send the same event twice. If THIS payment already confirmed the reservation, the
        // event is a duplicate: nothing to do, even if the reservation has moved on since (completed or
        // cancelled, GEN-11). Refunding here would give back the money of a used stay.
        const current = await this.bookingModel
          .findById(bookingId)
          .session(session);
        outcome.result =
          current?.paymentId?.toString() === paymentId
            ? 'already_confirmed'
            : 'not_confirmable';
        return;
      }

      const booked = await this.inventory.convertHeldToBooked(
        booking._id,
        booking.rooms.length * booking.nights,
        session,
      );
      if (!booked) {
        throw new Error(
          `Held room-nights of reservation ${bookingId} not found.`,
        );
      }
      outcome.result = 'confirmed';
    });

    if (outcome.result === 'confirmed') {
      this.logger.log(`Hotel reservation ${bookingId} confirmed.`);
      // TODO(GEN-01, Area 3): send the in-app notification with the reservation details (HTL-17).
    }
    return outcome.result;
  }

  toResponse(booking: HotelBookingDocument): HotelBookingResponse {
    const rooms = booking.rooms.map((r) => ({
      roomId: r.roomId.toString(),
      roomNumber: r.roomNumber,
      type: r.type,
      beds: r.beds,
      maxOccupancy: r.maxOccupancy,
      adults: r.adults,
      childrenAges: [...r.childrenAges],
      pricePerNight: r.pricePerNight,
      subtotal: r.subtotal,
    }));
    return {
      id: booking._id.toString(),
      reference: booking.reference ?? null,
      status: booking.status,
      holdExpiresAt:
        booking.status === BookingStatus.PendingPayment
          ? booking.holdExpiresAt
          : null,
      hotel: { id: booking.hotelId.toString(), name: booking.hotelName },
      checkIn: formatDate(booking.checkIn),
      checkOut: formatDate(booking.checkOut),
      nights: booking.nights,
      rooms,
      guests: {
        adults: rooms.reduce((sum, r) => sum + r.adults, 0),
        children: rooms.reduce((sum, r) => sum + r.childrenAges.length, 0),
      },
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      policiesAcceptedAt: booking.policiesAcceptedAt,
      paymentId: booking.paymentId?.toString() ?? null,
      confirmedAt: booking.confirmedAt,
      expiredAt: booking.expiredAt,
      cancelledAt: booking.cancelledAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
    };
  }

  // The requested rooms, in the request's order: 404 if one does not exist, 400 if it belongs to
  // another hotel or has too many guests (HTL-16).
  private async loadRooms(
    hotel: HotelDoc,
    requested: RoomGuestsDto[],
    session: ClientSession,
  ): Promise<RoomDoc[]> {
    const found = await this.rooms()
      .find(
        { _id: { $in: requested.map((r) => new Types.ObjectId(r.roomId)) } },
        { session },
      )
      .toArray();
    const byId = new Map(found.map((room) => [room._id.toString(), room]));

    return requested.map((guests) => {
      const room = byId.get(guests.roomId);
      if (!room)
        throw new NotFoundException(`Room ${guests.roomId} not found.`);
      if (String(room.hotelId) !== hotel._id.toString()) {
        throw new BadRequestException(
          'All rooms must belong to the selected hotel.',
        );
      }
      const count = guests.adults + (guests.childrenAges?.length ?? 0);
      if (count > room.maxOccupancy) {
        throw new BadRequestException(
          `Room ${room.roomNumber} takes at most ${room.maxOccupancy} guests (${count} given).`,
        );
      }
      return room;
    });
  }

  private hotels() {
    return this.connection.collection<HotelDoc>(HOTELS_COLLECTION);
  }

  private rooms() {
    return this.connection.collection<RoomDoc>(ROOMS_COLLECTION);
  }
}

// HTL-18: check-out after check-in, and check-in not in the past (today is allowed).
function checkStayDates(checkIn: Date, checkOut: Date): void {
  if (checkOut <= checkIn) {
    throw new BadRequestException('checkOut must be after checkIn.');
  }
  if (checkIn < todayUtc()) {
    throw new BadRequestException('checkIn cannot be in the past.');
  }
}

// HTL-16: each room once, at least one guest in every room, at least one adult in the reservation.
function checkGuests(rooms: RoomGuestsDto[]): void {
  if (new Set(rooms.map((r) => r.roomId)).size !== rooms.length) {
    throw new BadRequestException('Each room can be selected only once.');
  }
  if (rooms.some((r) => r.adults + (r.childrenAges?.length ?? 0) === 0)) {
    throw new BadRequestException(
      'Every selected room needs at least one guest.',
    );
  }
  if (!rooms.some((r) => r.adults > 0)) {
    throw new BadRequestException('A reservation needs at least one adult.');
  }
}

// HTL-18: every room is active and every night is inside a bookable range (HTL-04) and outside
// every blocked range (HTL-06); otherwise 409 and nothing is held. Nights taken by other
// reservations are refused by the room-night unique index.
function checkAvailability(rooms: RoomDoc[], nights: Date[]): void {
  for (const room of rooms) {
    const bookable =
      room.active !== false &&
      nights.every(
        (night) =>
          (room.availableRanges ?? []).some((r) => inRange(r, night)) &&
          !(room.blockedRanges ?? []).some((r) => inRange(r, night)),
      );
    if (!bookable) {
      throw new ConflictException(
        `Room ${room.roomNumber} is not available for these dates, so nothing was held.`,
      );
    }
  }
}

// from and to are both included (agreed with Area 7).
function inRange(range: DateRange, night: Date): boolean {
  const t = night.getTime();
  return (
    new Date(range.from).getTime() <= t && t <= new Date(range.to).getTime()
  );
}
