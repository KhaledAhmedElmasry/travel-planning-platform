import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { dateOnly, formatDate } from '../hotel-bookings/stay-dates';
import { parseStay } from './room-ranges';
import { isDuplicateKeyError } from '../payments/is-duplicate-key-error';
import { platformCurrency } from '../payments/platform-currency';
import type {
  CancellationTier,
  RefundTier,
} from '../payments/interfaces/payable-booking.interface';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { HotelDetailsQueryDto } from './dto/hotel-details-query.dto';
import { HotelPoliciesDto } from './dto/hotel-policies.dto';
import { RoomAvailabilityDto } from './dto/room-availability.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { BookingStatus } from '../common/enums';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import { HotelBooking } from '../hotel-bookings/schemas/hotel-booking.schema';
import { User } from '../users/schemas/user.schema';
import type { AuthUser } from '../common/interfaces';
import { pickRefundTier } from './hotel-refund-tier';
import { HotelSearchService } from './hotel-search.service';
import { Hotel, HotelDocument, HotelPhoto } from './schemas/hotel.schema';
import { Room, RoomDateRange, RoomDocument } from './schemas/room.schema';

// Area: Hotels & Rooms
// Business logic and database access for: HTL-01..HTL-06, HTL-08..HTL-12, HTL-15, HTL-22

export const MAX_HOTEL_PHOTOS = 5; // GEN-08

// Used when a moderator has not set the times yet (HTL-09), because a reservation always shows them.
const DEFAULT_CHECK_IN_TIME = '14:00';
const DEFAULT_CHECK_OUT_TIME = '12:00';

// A photo already stored by the upload service (GEN-08).
export interface NewHotelPhoto {
  url: string;
  filename: string;
}

export interface HotelDetailsResponse {
  id: string;
  name: string;
  address: string;
  cityId: string;
  countryCode: string;
  description: string;
  starRating: number;
  photos: { id: string; url: string }[];
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  cancellationTiers: CancellationTier[];
  averageRating: number;
  ratingCount: number;
  availableRooms?: {
    id: string;
    roomNumber: string;
    type: string;
    beds: number;
    maxOccupancy: number;
    pricePerNight: number;
    nights: number;
    totalPrice: number;
    currency: string;
    checkIn: string;
    checkOut: string;
  }[];
}

// The logged-in user (AuthUser has these fields). hotelId is the hotel a moderator manages.
export interface HotelActor {
  id: string;
  hotelId?: string | null;
}

// The hotel rules a reservation needs (HTL-09, HTL-10): shown before payment (PAY-02) and used
// for refunds (HTL-21).
export interface HotelBookingPoliciesData {
  hotelId: string;
  name: string;
  // HH:mm (HTL-09).
  checkInTime: string;
  checkOutTime: string;
  cancellationTiers: CancellationTier[];
}

export interface HotelReservationListItem {
  id: string;
  reference: string | null;
  guest: { id: string; name: string };
  rooms: { roomId: string; roomNumber: string; type: string }[];
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
}

@Injectable()
export class HotelsService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookingModel: Model<HotelBooking>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
    private readonly hotelSearch: HotelSearchService,
  ) {}

  // --- HTL-01: create (admin only; the controller enforces the role) ---

  async createHotel(dto: CreateHotelDto, photos: NewHotelPhoto[] = []) {
    if (photos.length > MAX_HOTEL_PHOTOS) {
      throw new BadRequestException(
        `A hotel can have at most ${MAX_HOTEL_PHOTOS} photos.`,
      );
    }
    await this.assertCityInCountry(dto.cityId, dto.countryCode);

    const hotel = await this.hotelModel.create({
      name: dto.name,
      address: dto.address,
      cityId: dto.cityId,
      countryCode: dto.countryCode,
      description: dto.description,
      starRating: dto.starRating,
      amenities: dto.amenities ?? [],
      photos,
      active: true,
    });
    return this.toResponse(hotel);
  }

  // --- HTL-02: public hotel profile and optional free rooms ---

  async getHotelDetails(
    hotelId: string,
    query: HotelDetailsQueryDto,
  ): Promise<HotelDetailsResponse> {
    if (!isValidObjectId(hotelId)) {
      throw new NotFoundException('Hotel not found.');
    }
    const hotel = await this.hotelModel.findOne({
      _id: hotelId,
      active: { $ne: false },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const hasCheckIn = query.checkIn !== undefined;
    const hasCheckOut = query.checkOut !== undefined;
    if (hasCheckIn !== hasCheckOut) {
      throw new BadRequestException(
        'checkIn and checkOut must be given together.',
      );
    }

    const response: HotelDetailsResponse = {
      id: hotel.id as string,
      name: hotel.name,
      address: hotel.address,
      cityId: hotel.cityId,
      countryCode: hotel.countryCode,
      description: hotel.description,
      starRating: hotel.starRating,
      photos: hotel.photos.map((photo) => ({
        id: this.photoId(photo),
        url: photo.url,
      })),
      amenities: hotel.amenities,
      checkInTime: hotel.checkInTime ?? DEFAULT_CHECK_IN_TIME,
      checkOutTime: hotel.checkOutTime ?? DEFAULT_CHECK_OUT_TIME,
      cancellationTiers: this.sortedTiers(hotel),
      averageRating: hotel.averageRating,
      ratingCount: hotel.ratingCount,
    };

    if (query.checkIn && query.checkOut) {
      const { checkIn, checkOut } = query;
      const stay = parseStay(checkIn, checkOut);
      const freeRooms = await this.hotelSearch.findFreeRooms([hotel._id], stay);
      const { guests } = query;
      const rooms =
        guests === undefined
          ? freeRooms
          : freeRooms.filter((room) => room.maxOccupancy >= guests);
      const currency = platformCurrency(this.config);
      response.availableRooms = rooms.map((room) => ({
        id: room.id as string,
        roomNumber: room.roomNumber,
        type: room.type,
        beds: room.beds,
        maxOccupancy: room.maxOccupancy,
        pricePerNight: room.pricePerNight,
        nights: stay.nights.length,
        totalPrice: room.pricePerNight * stay.nights.length,
        currency,
        checkIn,
        checkOut,
      }));
    }

    return response;
  }

  // --- HTL-01: edit (only the moderator assigned to THIS hotel) ---

  async updateHotel(
    hotelId: string,
    actor: HotelActor,
    dto: UpdateHotelDto,
    newPhotos: NewHotelPhoto[] = [],
  ) {
    const hotel = await this.findHotelOrThrow(hotelId);
    this.assertModeratorOf(hotel, actor);

    // If either the city or the country changes, the pair must still match.
    if (dto.cityId !== undefined || dto.countryCode !== undefined) {
      await this.assertCityInCountry(
        dto.cityId ?? hotel.cityId,
        dto.countryCode ?? hotel.countryCode,
      );
    }

    // Photos: remove the requested ones, add the new ones, at most 5 in total.
    const removeIds = new Set<string>(dto.removePhotoIds ?? []);
    const existingIds = new Set(hotel.photos.map((p) => this.photoId(p)));
    const unknownIds = [...removeIds].filter((id) => !existingIds.has(id));
    if (unknownIds.length > 0) {
      throw new BadRequestException(
        `Unknown photo id(s): ${unknownIds.join(', ')}.`,
      );
    }
    const kept = hotel.photos
      .filter((p) => !removeIds.has(this.photoId(p)))
      .map((p) => ({
        _id: this.rawPhotoId(p),
        url: p.url,
        filename: p.filename,
      }));
    if (kept.length + newPhotos.length > MAX_HOTEL_PHOTOS) {
      throw new BadRequestException(
        `A hotel can have at most ${MAX_HOTEL_PHOTOS} photos. It would have ${kept.length + newPhotos.length}.`,
      );
    }

    // Apply only the fields that were sent.
    if (dto.name !== undefined) hotel.name = dto.name;
    if (dto.address !== undefined) hotel.address = dto.address;
    if (dto.cityId !== undefined) hotel.cityId = dto.cityId;
    if (dto.countryCode !== undefined) hotel.countryCode = dto.countryCode;
    if (dto.description !== undefined) hotel.description = dto.description;
    if (dto.starRating !== undefined) hotel.starRating = dto.starRating;
    if (dto.amenities !== undefined) hotel.amenities = dto.amenities;
    hotel.set('photos', [...kept, ...newPhotos]);

    // NOTE: files of removed photos stay on disk until the upload service can delete them.
    await hotel.save();
    return this.toResponse(hotel);
  }

  // --- HTL-03: add a room (only the moderator assigned to THIS hotel) ---

  async createRoom(hotelId: string, actor: HotelActor, dto: CreateRoomDto) {
    const hotel = await this.findHotelOrThrow(hotelId);
    this.assertModeratorOf(hotel, actor);

    try {
      const room = await this.roomModel.create({
        hotelId: hotel._id,
        roomNumber: dto.roomNumber,
        type: dto.type,
        beds: dto.beds,
        maxOccupancy: dto.maxOccupancy,
        pricePerNight: dto.pricePerNight,
        active: true,
      });
      return this.toRoomResponse(room);
    } catch (error) {
      // The unique (hotelId, roomNumber) index refused a second room with this number.
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          `Room "${dto.roomNumber}" already exists in this hotel.`,
        );
      }
      throw error;
    }
  }

  // --- HTL-04: add a bookable date range to a room (moderator of THIS hotel) ---

  async addAvailableRange(
    hotelId: string,
    roomId: string,
    actor: HotelActor,
    dto: RoomAvailabilityDto,
  ) {
    const hotel = await this.findHotelOrThrow(hotelId);
    this.assertModeratorOf(hotel, actor);
    const room = await this.findRoomOrThrow(hotel, roomId);

    const from = this.parseDay(dto.from, 'from');
    const to = this.parseDay(dto.to, 'to');
    if (to.getTime() < from.getTime()) {
      throw new BadRequestException(
        'Invalid dates: "to" must not be before "from".',
      );
    }

    // One atomic update: the range is added only if it overlaps none of the room's bookable
    // ranges (both ends included), so two requests at the same moment cannot both succeed.
    const updated = await this.roomModel.findOneAndUpdate(
      {
        _id: room._id,
        availableRanges: {
          $not: { $elemMatch: { from: { $lte: to }, to: { $gte: from } } },
        },
      },
      {
        $push: {
          availableRanges: { $each: [{ from, to }], $sort: { from: 1 } },
        },
      },
      { new: true },
    );
    if (!updated) {
      // Either the room was deleted a moment ago, or the range overlaps another one.
      if (!(await this.roomModel.exists({ _id: room._id }))) {
        throw new NotFoundException('Room not found.');
      }
      throw new ConflictException(
        'The range overlaps another bookable range of the room.',
      );
    }
    return this.toAvailabilityResponse(updated);
  }

  // --- HTL-09, HTL-10: check-in/out times and cancellation tiers (moderator of THIS hotel) ---

  async updatePolicies(
    hotelId: string,
    actor: HotelActor,
    dto: HotelPoliciesDto,
  ) {
    const hotel = await this.findHotelOrThrow(hotelId);
    this.assertModeratorOf(hotel, actor);

    // Each tier needs its own days-before-check-in threshold.
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    for (const tier of dto.cancellationTiers) {
      if (seen.has(tier.daysBefore)) duplicates.add(tier.daysBefore);
      seen.add(tier.daysBefore);
    }
    if (duplicates.size > 0) {
      throw new BadRequestException(
        `Each cancellation tier needs a unique daysBefore. Used more than once: ${[...duplicates].join(', ')}.`,
      );
    }

    // Stored with the highest threshold first.
    const tiers = dto.cancellationTiers
      .map((t) => ({
        daysBefore: t.daysBefore,
        refundPercentage: t.refundPercentage,
      }))
      .sort((a, b) => b.daysBefore - a.daysBefore);

    // ONE atomic update that replaces everything: the last write wins. (hotel.set + hotel.save
    // would check the document version, so requests at the same moment would fail with a
    // VersionError.)
    const updated = await this.hotelModel.findByIdAndUpdate(
      hotel._id,
      {
        $set: {
          checkInTime: dto.checkInTime,
          checkOutTime: dto.checkOutTime,
          cancellationTiers: tiers,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) throw new NotFoundException('Hotel not found.');

    return {
      hotelId: updated.id as string,
      checkInTime: updated.checkInTime,
      checkOutTime: updated.checkOutTime,
      cancellationTiers: this.sortedTiers(updated),
    };
  }

  // --- Used by hotel bookings (Area 1: PAY-02, HTL-21) ---

  // The hotel's name, times and tiers (highest daysBefore first), or null if it does not exist.
  async getBookingPolicies(
    hotelId: string,
  ): Promise<HotelBookingPoliciesData | null> {
    if (!isValidObjectId(hotelId)) return null;
    const hotel = await this.hotelModel.findById(hotelId);
    if (!hotel) return null;
    return {
      hotelId: hotel.id as string,
      name: hotel.name,
      checkInTime: hotel.checkInTime ?? DEFAULT_CHECK_IN_TIME,
      checkOutTime: hotel.checkOutTime ?? DEFAULT_CHECK_OUT_TIME,
      cancellationTiers: this.sortedTiers(hotel),
    };
  }

  // HTL-10: the tier that applies when the guest cancels this many days before check-in.
  async getRefundTier(
    hotelId: string,
    daysBeforeCheckIn: number,
  ): Promise<RefundTier> {
    const hotel = await this.findHotelOrThrow(hotelId);
    return pickRefundTier(this.sortedTiers(hotel), daysBeforeCheckIn);
  }

  // HTL-22: only the moderator assigned to the requested hotel can view its reservations.
  async listReservations(
    hotelId: string,
    actor: AuthUser,
    query: ListReservationsQueryDto,
  ): Promise<PaginatedList<HotelReservationListItem>> {
    const hotel = await this.findHotelOrThrow(hotelId);
    this.assertModeratorOf(hotel, actor);

    const from = query.from ? this.parseDay(query.from, 'from') : undefined;
    const to = query.to ? this.parseDay(query.to, 'to') : undefined;
    if (from && to && to < from) {
      throw new BadRequestException('"to" must not be before "from".');
    }

    const filter: Record<string, unknown> = { hotelId: hotel._id };
    if (query.status) filter.status = query.status;
    // Only add the bounds that were sent: an `undefined` value in the filter is stored as null
    // and matches nothing, so "from" alone or "to" alone returned an empty list.
    if (from) filter.checkOut = { $gte: from };
    if (to) filter.checkIn = { $lte: to };
    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);
    const [bookings, total] = await Promise.all([
      this.hotelBookingModel
        .find(filter)
        .sort({ checkIn: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.hotelBookingModel.countDocuments(filter).exec(),
    ]);
    const users = await this.userModel
      .find({
        _id: { $in: bookings.map((booking) => booking.userId) },
      })
      .select('_id name')
      .lean<Array<{ _id: Types.ObjectId; name: string }>>();
    const names = new Map(
      users.map((user) => [user._id.toString(), user.name]),
    );
    return paginate(
      bookings.map((booking) => ({
        id: booking._id.toString(),
        reference: booking.reference ?? null,
        guest: {
          id: booking.userId.toString(),
          name: names.get(booking.userId.toString()) ?? 'Unknown guest',
        },
        rooms: booking.rooms.map((room) => ({
          roomId: room.roomId.toString(),
          roomNumber: room.roomNumber,
          type: room.type,
        })),
        checkIn: formatDate(booking.checkIn),
        checkOut: formatDate(booking.checkOut),
        status: booking.status,
      })),
      total,
      page,
    );
  }

  // --- helpers ---

  private sortedTiers(hotel: HotelDocument): CancellationTier[] {
    return hotel.cancellationTiers
      .map((t) => ({
        daysBefore: t.daysBefore,
        refundPercentage: t.refundPercentage,
      }))
      .sort((a, b) => b.daysBefore - a.daysBefore);
  }

  private async findHotelOrThrow(hotelId: string): Promise<HotelDocument> {
    if (!isValidObjectId(hotelId))
      throw new NotFoundException('Hotel not found.');
    const hotel = await this.hotelModel.findById(hotelId);
    if (!hotel) throw new NotFoundException('Hotel not found.');
    return hotel;
  }

  // The room must exist AND belong to this hotel.
  private async findRoomOrThrow(
    hotel: HotelDocument,
    roomId: string,
  ): Promise<RoomDocument> {
    if (!isValidObjectId(roomId))
      throw new NotFoundException('Room not found.');
    const room = await this.roomModel.findOne({
      _id: roomId,
      hotelId: hotel._id,
    });
    if (!room) throw new NotFoundException('Room not found.');
    return room;
  }

  // ACC-11, ACC-13: a moderator manages exactly one hotel, and only that one.
  private assertModeratorOf(hotel: HotelDocument, actor: HotelActor) {
    if (!actor.hotelId || String(actor.hotelId) !== hotel.id) {
      throw new ForbiddenException(
        'You can only manage the hotel you are assigned to.',
      );
    }
  }

  // "2027-03-01" -> that calendar date at 00:00 UTC, or 400 if it is not a real date (2027-02-30).
  private parseDay(text: string, field: string): Date {
    const date = dateOnly(text);
    if (Number.isNaN(date.getTime()) || formatDate(date) !== text) {
      throw new BadRequestException(`${field} is not a valid date: "${text}".`);
    }
    return date;
  }

  // GEN-12: the country and city must exist, and the city must belong to the country.
  // TODO: replace with ReferenceDataService once Area 5 exports its lookups.
  private async assertCityInCountry(cityId: string, countryCode: string) {
    const db = this.connection.db!;
    const country = await db
      .collection<{ _id: string }>('countries')
      .findOne({ _id: countryCode });
    if (!country) {
      throw new BadRequestException(`Unknown countryCode "${countryCode}".`);
    }
    const city = await db
      .collection<{ _id: string; countryCode: string }>('cities')
      .findOne({ _id: cityId });
    if (!city) {
      throw new BadRequestException(`Unknown cityId "${cityId}".`);
    }
    if (city.countryCode !== countryCode) {
      throw new BadRequestException(
        `City "${cityId}" is not in country "${countryCode}".`,
      );
    }
  }

  private rawPhotoId(photo: HotelPhoto): Types.ObjectId {
    return (photo as unknown as { _id: Types.ObjectId })._id;
  }

  private photoId(photo: HotelPhoto): string {
    return String(this.rawPhotoId(photo));
  }

  private formatRanges(ranges: RoomDateRange[]) {
    return ranges.map((r) => ({
      from: formatDate(r.from),
      to: formatDate(r.to),
    }));
  }

  private toResponse(hotel: HotelDocument) {
    return {
      id: hotel.id as string,
      name: hotel.name,
      address: hotel.address,
      cityId: hotel.cityId,
      countryCode: hotel.countryCode,
      description: hotel.description,
      starRating: hotel.starRating,
      amenities: hotel.amenities,
      photos: hotel.photos.map((p) => ({ id: this.photoId(p), url: p.url })),
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      cancellationTiers: hotel.cancellationTiers,
      active: hotel.active,
      averageRating: hotel.averageRating,
      ratingCount: hotel.ratingCount,
      createdAt: hotel.get('createdAt') as Date | undefined,
      updatedAt: hotel.get('updatedAt') as Date | undefined,
    };
  }

  private toRoomResponse(room: RoomDocument) {
    return {
      id: room.id as string,
      hotelId: String(room.hotelId),
      roomNumber: room.roomNumber,
      type: room.type,
      beds: room.beds,
      maxOccupancy: room.maxOccupancy,
      pricePerNight: room.pricePerNight,
      // PAY-04: every price is in the platform currency (integer cents).
      currency: platformCurrency(this.config),
      active: room.active,
      availableRanges: this.formatRanges(room.availableRanges),
      blockedRanges: this.formatRanges(room.blockedRanges),
      createdAt: room.get('createdAt') as Date | undefined,
      updatedAt: room.get('updatedAt') as Date | undefined,
    };
  }
  // The room's bookable and blocked ranges (HTL-04, HTL-05, HTL-06).
  private toAvailabilityResponse(room: RoomDocument) {
    return {
      roomId: room.id as string,
      roomNumber: room.roomNumber,
      availableRanges: this.formatRanges(room.availableRanges),
      blockedRanges: this.formatRanges(room.blockedRanges),
    };
  }
}
