import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { formatDate } from '../hotel-bookings/stay-dates';
import { isDuplicateKeyError } from '../payments/is-duplicate-key-error';
import type {
  CancellationTier,
  RefundTier,
} from '../payments/interfaces/payable-booking.interface';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { Hotel, HotelDocument, HotelPhoto } from './schemas/hotel.schema';
import { Room, RoomDocument } from './schemas/room.schema';

// Area: Hotels & Rooms
// Business logic and database access for: HTL-01..HTL-06, HTL-08..HTL-12, HTL-15, HTL-22

export const MAX_HOTEL_PHOTOS = 5; // GEN-08

// A photo already stored by the upload service (GEN-08).
export interface NewHotelPhoto {
  url: string;
  filename: string;
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

@Injectable()
export class HotelsService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectConnection() private readonly connection: Connection,
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

  // --- helpers ---

  private async findHotelOrThrow(hotelId: string): Promise<HotelDocument> {
    if (!isValidObjectId(hotelId))
      throw new NotFoundException('Hotel not found.');
    const hotel = await this.hotelModel.findById(hotelId);
    if (!hotel) throw new NotFoundException('Hotel not found.');
    return hotel;
  }

  // ACC-11, ACC-13: a moderator manages exactly one hotel, and only that one.
  private assertModeratorOf(hotel: HotelDocument, actor: HotelActor) {
    if (!actor.hotelId || String(actor.hotelId) !== hotel.id) {
      throw new ForbiddenException(
        'You can only manage the hotel you are assigned to.',
      );
    }
  }

  // NEW-05: the country and city must exist, and the city must belong to the country.
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
      active: room.active,
      availableRanges: room.availableRanges.map((r) => ({
        from: formatDate(r.from),
        to: formatDate(r.to),
      })),
      blockedRanges: room.blockedRanges.map((r) => ({
        from: formatDate(r.from),
        to: formatDate(r.to),
      })),
      createdAt: room.get('createdAt') as Date | undefined,
      updatedAt: room.get('updatedAt') as Date | undefined,
    };
  }

  // --- Used by hotel bookings (Area 1: PAY-02, HTL-21) ---

  // WAITING FOR (Area 7, HTL-01 / HTL-09 / HTL-10): the hotel schema with its check-in and
  // check-out times and cancellation tiers.
  // TODO(HTL-09, HTL-10; Area 7): find the hotel (null if it does not exist) and return its name,
  // checkInTime, checkOutTime and cancellationTiers sorted by daysBefore (highest first).
  getBookingPolicies(
    _hotelId: string,
  ): Promise<HotelBookingPoliciesData | null> {
    throw new NotImplementedException(
      'Hotel policies are not implemented yet (HTL-09, HTL-10).',
    );
  }

  // WAITING FOR (Area 7, HTL-10): the cancellation tiers and the shared tier rule in common/utils
  // (FLT-09, also used by AirlinesService.getRefundTier()).
  // TODO(HTL-10; Area 7): apply the rule to the hotel's tiers: the tier with the highest
  // daysBefore that is not more than daysBeforeCheckIn; if none applies, 0% and null.
  // Example: tiers 14 -> 100%, 3 -> 50%; 5 days left -> { refundPercentage: 50, tierDaysBefore: 3 }.
  getRefundTier(
    _hotelId: string,
    _daysBeforeCheckIn: number,
  ): Promise<RefundTier> {
    throw new NotImplementedException(
      'Hotel cancellation tiers are not implemented yet (HTL-10).',
    );
  }
}
