import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { BookingStatus, BookingType } from '../common/enums';
import { AttachBookingDto } from './dto/attach-booking.dto';

// Area: Itineraries
// ITN-27 (bonus): a user's Confirmed flight bookings and hotel reservations can be linked to a
// day of their own itinerary, and their prices feed the budget summary.
//
// The links live in their own collection with a unique (bookingType, bookingId) index, so one
// booking is linked at most once, even when two requests link it at the same moment. The
// bookings are read through their collections (flightbookings / hotelbookings), so this module
// needs no import of the booking modules. Prices stay in the platform currency (PAY-04) and are
// never converted (ITN-18); they are returned as decimal amounts like the other budget amounts.
export interface LinkedBookingResponse {
  id: string;
  bookingType: BookingType;
  bookingId: string;
  dayId: string;
  reference: string | null;
  description: string;
  amount: number;
  currency: string;
  status: BookingStatus;
}

interface LinkDocument {
  _id: Types.ObjectId;
  itineraryId: Types.ObjectId;
  dayId: Types.ObjectId;
  userId: Types.ObjectId;
  bookingType: BookingType;
  bookingId: Types.ObjectId;
  linkedAt: Date;
}

interface BookingDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: BookingStatus;
  reference?: string;
  totalAmount: number;
  currency: string;
  // flights
  segments?: {
    flightNumber: string;
    departureAirport: { code: string };
    arrivalAirport: { code: string };
  }[];
  // hotels
  hotelName?: string;
  checkIn?: Date;
  checkOut?: Date;
}

const NOT_FOUND =
  'Itinerary, day or booking not found, or they belong to another user.';
const ALREADY = 'The booking is not Confirmed, or it is already linked.';

// A linked booking keeps feeding the budget while it is Confirmed and after it is Completed;
// a cancelled or expired one drops out.
const COUNTED = [BookingStatus.Confirmed, BookingStatus.Completed];

@Injectable()
export class ItineraryBookingsService implements OnModuleInit {
  private readonly logger = new Logger(ItineraryBookingsService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.links().createIndex(
        { bookingType: 1, bookingId: 1 },
        { unique: true },
      );
      await this.links().createIndex({ itineraryId: 1 });
    } catch (error) {
      this.logger.error(`Could not create the link indexes: ${String(error)}`);
    }
  }

  private links() {
    return this.connection.collection<LinkDocument>('itinerary_booking_links');
  }

  private bookings(type: BookingType) {
    return this.connection.collection<BookingDocument>(
      type === BookingType.Flight ? 'flightbookings' : 'hotelbookings',
    );
  }

  // The caller has already checked that the itinerary is the user's and that dayId is one of
  // its days.
  async link(
    itineraryId: Types.ObjectId,
    userId: string,
    dto: AttachBookingDto,
  ): Promise<LinkedBookingResponse> {
    const userObjectId = new Types.ObjectId(userId);
    const bookingObjectId = new Types.ObjectId(dto.bookingId);
    const booking = await this.bookings(dto.bookingType).findOne({
      _id: bookingObjectId,
      userId: userObjectId,
    });
    if (!booking) throw new NotFoundException(NOT_FOUND);
    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException(ALREADY);
    }

    const document: LinkDocument = {
      _id: new Types.ObjectId(),
      itineraryId,
      dayId: new Types.ObjectId(dto.dayId),
      userId: userObjectId,
      bookingType: dto.bookingType,
      bookingId: bookingObjectId,
      linkedAt: new Date(),
    };
    await this.insertLink(document);
    return this.toResponse(document, booking);
  }

  private async insertLink(
    document: LinkDocument,
    retry = true,
  ): Promise<void> {
    try {
      await this.links().insertOne(document);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // The booking is already linked. A link whose itinerary or day no longer exists is a
      // leftover: it is replaced, once. Anything else is a real 409.
      const existing = await this.links().findOne({
        bookingType: document.bookingType,
        bookingId: document.bookingId,
      });
      if (existing && retry && !(await this.dayStillExists(existing))) {
        await this.links().deleteOne({ _id: existing._id });
        return this.insertLink(document, false);
      }
      throw new ConflictException(ALREADY);
    }
  }

  private async dayStillExists(link: LinkDocument): Promise<boolean> {
    const found = await this.connection
      .collection('itineraries')
      .countDocuments({ _id: link.itineraryId, 'days._id': link.dayId });
    return found > 0;
  }

  // The linked bookings of an itinerary whose day still exists and whose booking still counts.
  async list(
    itineraryId: Types.ObjectId,
    dayIds: Types.ObjectId[],
  ): Promise<LinkedBookingResponse[]> {
    const links = await this.links()
      .find({ itineraryId, dayId: { $in: dayIds } })
      .sort({ linkedAt: 1, _id: 1 })
      .toArray();
    if (links.length === 0) return [];
    const result: LinkedBookingResponse[] = [];
    for (const type of [BookingType.Flight, BookingType.Hotel]) {
      const ofType = links.filter((link) => link.bookingType === type);
      if (ofType.length === 0) continue;
      const found = await this.bookings(type)
        .find({
          _id: { $in: ofType.map((link) => link.bookingId) },
          status: { $in: COUNTED },
        })
        .toArray();
      const byId = new Map(found.map((b) => [b._id.toString(), b]));
      for (const link of ofType) {
        const booking = byId.get(link.bookingId.toString());
        if (booking) result.push(this.toResponse(link, booking));
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  // Removes one link of this itinerary; false when the itinerary has no link with that id. The
  // booking itself is not touched (it stays booked).
  async unlink(
    itineraryId: Types.ObjectId,
    linkId: Types.ObjectId,
  ): Promise<boolean> {
    const { deletedCount } = await this.links().deleteOne({
      _id: linkId,
      itineraryId,
    });
    return deletedCount === 1;
  }

  async removeForDay(
    itineraryId: Types.ObjectId,
    dayId: Types.ObjectId,
  ): Promise<void> {
    await this.links().deleteMany({ itineraryId, dayId });
  }

  async removeForItinerary(itineraryId: Types.ObjectId): Promise<void> {
    await this.links().deleteMany({ itineraryId });
  }

  private toResponse(
    link: LinkDocument,
    booking: BookingDocument,
  ): LinkedBookingResponse {
    const type = link.bookingType;
    const segments = booking.segments ?? [];
    const day = (date?: Date) => date?.toISOString().slice(0, 10) ?? '';
    const description =
      type === BookingType.Flight
        ? segments.length > 0
          ? `Flight ${segments
              .map(
                (s) =>
                  `${s.flightNumber} ${s.departureAirport.code}-${s.arrivalAirport.code}`,
              )
              .join(', ')}`
          : 'Flight'
        : `Hotel ${booking.hotelName ?? ''} ${day(booking.checkIn)} to ${day(booking.checkOut)}`.trim();
    return {
      id: link._id.toString(),
      bookingType: type,
      bookingId: link.bookingId.toString(),
      dayId: link.dayId.toString(),
      reference: booking.reference ?? null,
      description,
      // The platform amounts are integer cents; budget amounts are decimals.
      amount: booking.totalAmount / 100,
      currency: booking.currency,
      status: booking.status,
    };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
