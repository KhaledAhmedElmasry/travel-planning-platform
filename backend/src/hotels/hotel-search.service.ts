import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { paginate, getPaginationOffset } from '../common/dto';
import { RoomInventoryService } from '../hotel-bookings/room-inventory.service';
import { formatDate } from '../hotel-bookings/stay-dates';
import { platformCurrency } from '../payments/platform-currency';
import { AvailableRoomsQueryDto } from './dto/available-rooms-query.dto';
import { isBookableFor, parseStay, Stay } from './room-ranges';
import { Hotel } from './schemas/hotel.schema';
import { Room, RoomDocument } from './schemas/room.schema';

// Area: Hotels & Rooms
// Business logic for: HTL-15 (the rooms of a hotel that are free for the searched dates)
//
// "Free" means what Area 1's hold accepts (HTL-18): the room is active, every night of the stay is
// inside a bookable range (HTL-04) and outside every blocked range (HTL-06), and no Confirmed
// reservation or unexpired hold has one of the nights (RoomInventoryService). The list is a
// snapshot: the hold itself checks again, so a room taken a second later gives a clear 409 there.

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
