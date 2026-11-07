import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { getPaginationOffset, paginate, PaginatedList } from '../common/dto';
import { RoomInventoryService } from '../hotel-bookings/room-inventory.service';
import { formatDate } from '../hotel-bookings/stay-dates';
import { platformCurrency } from '../payments/platform-currency';
import { AvailableRoomsQueryDto } from './dto/available-rooms-query.dto';
import { SearchHotelsQueryDto } from './dto/search-hotels-query.dto';
import { isBookableFor, parseStay, Stay } from './room-ranges';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { Room, RoomDocument } from './schemas/room.schema';

// Area: Hotels & Rooms
// Business logic for: HTL-15 (the rooms of a hotel that are free for the searched dates) and
// HTL-11 (hotel search). Exported for Area 6: GET /api/itineraries/:id/hotels (ITN-25) calls
// search() with the city group's city and dates.
//
// "Free" means what Area 1's hold accepts (HTL-18): the room is active, every night of the stay is
// inside a bookable range (HTL-04) and outside every blocked range (HTL-06), and no Confirmed
// reservation or unexpired hold has one of the nights (RoomInventoryService). The list is a
// snapshot: the hold itself checks again, so a room taken a second later gives a clear 409 there.

// One hotel in the search results (GET /api/hotels/search and ITN-25).
export interface HotelSearchResult {
  id: string;
  name: string;
  cityId: string;
  countryCode: string;
  starRating: number;
  photo: string | null; // URL of the first photo
  averageRating: number;
  ratingCount: number;
  // Price per night in cents of the cheapest qualifying room (see qualify() below).
  pricePerNight: number;
  currency: string;
  freeRooms: number;
}

@Injectable()
export class HotelSearchService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    private readonly inventory: RoomInventoryService,
    private readonly config: ConfigService,
  ) {}

  // --- HTL-15: GET /api/hotels/:id/rooms/available ---

  async listAvailableRooms(hotelId: string, query: AvailableRoomsQueryDto) {
    const stay = parseStay(query.checkIn, query.checkOut);
    const hotel = await this.hotelModel.findOne(
      { _id: hotelId, active: { $ne: false } },
      { _id: 1 },
    );
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const free = await this.findFreeRooms([hotel._id], stay);
    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page);
    const nights = stay.nights.length;
    const currency = platformCurrency(this.config);
    const items = free.slice(skip, skip + limit).map((room) => ({
      id: room.id as string,
      roomNumber: room.roomNumber,
      type: room.type,
      beds: room.beds,
      maxOccupancy: room.maxOccupancy,
      pricePerNight: room.pricePerNight,
      nights,
      totalPrice: room.pricePerNight * nights,
      currency,
      checkIn: formatDate(stay.checkIn),
      checkOut: formatDate(stay.checkOut),
    }));
    return paginate(items, free.length, page);
  }

  // --- HTL-11: GET /api/hotels/search (also ITN-25) ---

  // Active hotels in the city or country with at least `rooms` free rooms for the whole stay
  // whose combined maximum occupancy covers the guests. Cheapest first.
  async search(
    query: SearchHotelsQueryDto,
  ): Promise<PaginatedList<HotelSearchResult>> {
    if (!query.city && !query.country) {
      throw new BadRequestException('Give a city or a country.');
    }
    const stay = parseStay(query.checkIn, query.checkOut);
    const rooms = query.rooms ?? 1;
    if (rooms > query.guests) {
      throw new BadRequestException(
        'rooms cannot be more than guests: every room needs at least one guest.',
      );
    }
    const page = query.page ?? 1;

    const filter: Record<string, unknown> = { active: { $ne: false } };
    if (query.city) filter.cityId = query.city;
    if (query.country) filter.countryCode = query.country;
    const hotels = await this.hotelModel.find(filter);
    if (hotels.length === 0) return paginate([], 0, page);

    const free = await this.findFreeRooms(
      hotels.map((h) => h._id),
      stay,
    );
    const byHotel = new Map<string, RoomDocument[]>();
    for (const room of free) {
      const key = room.hotelId.toString();
      byHotel.set(key, [...(byHotel.get(key) ?? []), room]);
    }

    const currency = platformCurrency(this.config);
    const results: HotelSearchResult[] = [];
    for (const hotel of hotels) {
      const price = qualify(
        byHotel.get(hotel._id.toString()) ?? [],
        query.guests,
        rooms,
      );
      if (price !== null) {
        results.push(
          this.toResult(
            hotel,
            price,
            byHotel.get(hotel._id.toString())!,
            currency,
          ),
        );
      }
    }
    results.sort(
      (a, b) =>
        a.pricePerNight - b.pricePerNight || a.name.localeCompare(b.name),
    );

    const { skip, limit } = getPaginationOffset(page);
    return paginate(results.slice(skip, skip + limit), results.length, page);
  }

  private toResult(
    hotel: HotelDocument,
    pricePerNight: number,
    freeRooms: RoomDocument[],
    currency: string,
  ): HotelSearchResult {
    return {
      id: hotel.id as string,
      name: hotel.name,
      cityId: hotel.cityId,
      countryCode: hotel.countryCode,
      starRating: hotel.starRating,
      photo: hotel.photos?.[0]?.url ?? null,
      averageRating: hotel.averageRating ?? 0,
      ratingCount: hotel.ratingCount ?? 0,
      pricePerNight,
      currency,
      freeRooms: freeRooms.length,
    };
  }

  // --- shared: HTL-15 and the hotel search (HTL-11) ---

  // The rooms of these hotels that are free on every night of the stay, cheapest first.
  async findFreeRooms(
    hotelIds: Types.ObjectId[],
    stay: Stay,
  ): Promise<RoomDocument[]> {
    const first = stay.nights[0];
    const last = stay.nights[stay.nights.length - 1];
    // The database only returns rooms with a bookable range that touches the stay; the exact
    // night-by-night check follows.
    const candidates = await this.roomModel
      .find({
        hotelId: { $in: hotelIds },
        active: { $ne: false },
        availableRanges: {
          $elemMatch: { from: { $lte: last }, to: { $gte: first } },
        },
      })
      .sort({ pricePerNight: 1, roomNumber: 1 });

    const bookable = candidates.filter((room) =>
      isBookableFor(room, stay.nights),
    );
    if (bookable.length === 0) return [];

    const taken = await this.inventory.findTakenNights(
      bookable.map((room) => room._id),
      first,
      last,
    );
    const takenRooms = new Set(taken.map((t) => t.roomId.toString()));
    return bookable.filter((room) => !takenRooms.has(room._id.toString()));
  }
}

// HTL-11: can the hotel host the guests in `rooms` of its free rooms (cheapest first)? Each room
// needs at least one guest and holds at most its maximum occupancy, so it can when there are
// enough free rooms and the `rooms` largest of them together hold everyone. Returns the price per
// night shown in the results, or null when the hotel does not qualify:
// - 1 room: the cheapest free room that holds all the guests;
// - more rooms: the cheapest free room (the price the stay starts from).
export function qualify(
  free: { maxOccupancy: number; pricePerNight: number }[],
  guests: number,
  rooms: number,
): number | null {
  if (free.length < rooms) return null;
  const capacity = free
    .map((r) => r.maxOccupancy)
    .sort((a, b) => b - a)
    .slice(0, rooms)
    .reduce((sum, n) => sum + n, 0);
  if (capacity < guests) return null;
  const candidates =
    rooms === 1 ? free.filter((r) => r.maxOccupancy >= guests) : free;
  return Math.min(...candidates.map((r) => r.pricePerNight));
}
