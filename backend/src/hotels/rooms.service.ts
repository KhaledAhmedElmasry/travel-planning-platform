import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, isValidObjectId, Model } from 'mongoose';
import { RoomInventoryService } from '../hotel-bookings/room-inventory.service';
import { platformCurrency } from '../payments/platform-currency';
import { HotelBooking } from '../hotel-bookings/schemas/hotel-booking.schema';
import { dateOnly, formatDate, todayUtc } from '../hotel-bookings/stay-dates';
import { assertManagesHotel } from '../common/guards/ownership';
import type { AuthUser } from '../common/interfaces';
import {
  RoomAvailabilityAction,
  UpdateRoomAvailabilityDto,
} from './dto/update-room-availability.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import {
  addRange,
  formatRanges,
  NightRange,
  overlaps,
  parseNightRange,
  subtractRange,
} from './room-ranges';
import { Hotel } from './schemas/hotel.schema';
import { Room, RoomDocument } from './schemas/room.schema';

// Area: Hotels & Rooms
// Business logic for: HTL-05 (edit a room, remove bookable nights) and HTL-06 (block and
// unblock nights, deactivate and delete a room)
//
// Every change that depends on reservations runs in ONE transaction that first reads the room
// and then writes it. Area 1's hold writes the same room document in its own transaction
// (hotel-bookings.service.ts, lastReservedAt), so a room change and a hold saved at the same
// moment conflict: MongoDB aborts one of them, it runs again and sees the other one.

// "From today on" (HTL-06 deactivation): every night up to this date.
const LAST_NIGHT = dateOnly('9999-12-31');

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectConnection() private readonly connection: Connection,
    private readonly inventory: RoomInventoryService,
    private readonly config: ConfigService,
  ) {}

  // --- HTL-05: edit beds, maximum occupancy and price per night; HTL-06: deactivate ---

  async updateRoom(
    hotelId: string,
    roomId: string,
    actor: AuthUser,
    dto: UpdateRoomDto,
  ) {
    await this.assertModeratorOfHotel(hotelId, actor);

    const changes: Partial<Room> = {};
    if (dto.beds !== undefined) changes.beds = dto.beds;
    if (dto.maxOccupancy !== undefined) changes.maxOccupancy = dto.maxOccupancy;
    if (dto.pricePerNight !== undefined)
      changes.pricePerNight = dto.pricePerNight;
    if (dto.active !== undefined) changes.active = dto.active;
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'Send at least one field to change: beds, maxOccupancy, pricePerNight or active.',
      );
    }

    let result: RoomDocument | null = null;
    await this.connection.transaction(async (session) => {
      const room = await this.findRoomOrThrow(hotelId, roomId, session);
      // HTL-06: a room with a Confirmed reservation or a hold being paid from today on stays
      // active, so those guests keep their room.
      if (dto.active === false && room.active !== false) {
        await this.assertNoReservations(
          room,
          { from: todayUtc(), to: LAST_NIGHT },
          'The room cannot be deactivated because it has Confirmed or Pending Payment reservations',
        );
      }
      // Reservations store the price they were booked at, so a new price only applies to new
      // reservations (HTL-05).
      result = await this.roomModel.findOneAndUpdate(
        { _id: room._id },
        { $set: changes },
        { new: true, runValidators: true, session },
      );
      if (!result) throw new NotFoundException('Room not found.');
    });
    return this.toRoomResponse(result!);
  }

  // --- HTL-06: delete a room that has never been reserved ---

  async deleteRoom(
    hotelId: string,
    roomId: string,
    actor: AuthUser,
  ): Promise<void> {
    await this.assertModeratorOfHotel(hotelId, actor);

    await this.connection.transaction(async (session) => {
      const room = await this.findRoomOrThrow(hotelId, roomId, session);
      // Area 1 sets lastReservedAt on every hold, and every reservation lists its rooms. Either
      // one means the room has been reserved, so its reservations still need it.
      const reserved =
        room.lastReservedAt != null ||
        (await this.connection
          .model<HotelBooking>(HotelBooking.name)
          .exists({ 'rooms.roomId': room._id })
          .session(session)) !== null;
      // lastReservedAt: null in the filter as well, so a hold saved a moment ago stops the delete.
      const deleted = reserved
        ? { deletedCount: 0 }
        : await this.roomModel
            .deleteOne({ _id: room._id, lastReservedAt: null })
            .session(session);
      if (deleted.deletedCount !== 1) {
        throw new ConflictException(
          'The room has been reserved before and cannot be deleted. Deactivate it instead.',
        );
      }
    });
  }

  // --- HTL-05: remove bookable nights; HTL-06: block and unblock nights ---

  async updateAvailability(
    hotelId: string,
    roomId: string,
    actor: AuthUser,
    dto: UpdateRoomAvailabilityDto,
  ) {
    await this.assertModeratorOfHotel(hotelId, actor);
    const range = parseNightRange(dto.from, dto.to);

    let result: RoomDocument | null = null;
    await this.connection.transaction(async (session) => {
      const room = await this.findRoomOrThrow(hotelId, roomId, session);
      switch (dto.action) {
        case RoomAvailabilityAction.Remove:
          result = await this.removeNights(room, range, session);
          break;
        case RoomAvailabilityAction.Block:
          result = await this.blockNights(room, range, session);
          break;
        case RoomAvailabilityAction.Unblock:
          result = await this.unblockNights(room, range, session);
          break;
      }
    });
    return this.toAvailabilityResponse(result!);
  }

  // Removes the nights from the bookable ranges, splitting a range in two when needed. Refused
  // if a Confirmed reservation or a hold that is still being paid has one of these nights, so
  // nobody ends up with a stay on nights the room no longer offers.
  private async removeNights(
    room: RoomDocument,
    range: NightRange,
    session: ClientSession,
  ): Promise<RoomDocument> {
    if (!room.availableRanges.some((r) => overlaps(r, range))) {
      throw new BadRequestException(
        'None of these nights are bookable, so nothing was removed.',
      );
    }
    await this.assertNoReservations(
      room,
      range,
      'These nights have reservations, so nothing was removed',
    );
    return this.saveRanges(
      room,
      { availableRanges: subtractRange(room.availableRanges, range) },
      session,
    );
  }

  // HTL-06: blocked nights cannot be booked. Refused if a Confirmed reservation or a hold that
  // is still being paid has one of these nights. Overlapping or touching blocks are joined.
  private async blockNights(
    room: RoomDocument,
    range: NightRange,
    session: ClientSession,
  ): Promise<RoomDocument> {
    await this.assertNoReservations(
      room,
      range,
      'These nights have Confirmed or Pending Payment reservations, so nothing was blocked',
    );
    return this.saveRanges(
      room,
      { blockedRanges: addRange(room.blockedRanges, range) },
      session,
    );
  }

  // HTL-06: removes the block from these nights, splitting a block in two when needed.
  private async unblockNights(
    room: RoomDocument,
    range: NightRange,
    session: ClientSession,
  ): Promise<RoomDocument> {
    if (!room.blockedRanges.some((r) => overlaps(r, range))) {
      throw new BadRequestException(
        'None of these nights are blocked, so nothing was unblocked.',
      );
    }
    return this.saveRanges(
      room,
      { blockedRanges: subtractRange(room.blockedRanges, range) },
      session,
    );
  }

  // --- helpers ---

  // 404 if the hotel does not exist, 403 if the user is not the moderator of THIS hotel (ACC-11).
  private async assertModeratorOfHotel(hotelId: string, actor: AuthUser) {
    if (
      !isValidObjectId(hotelId) ||
      !(await this.hotelModel.exists({ _id: hotelId }))
    ) {
      throw new NotFoundException('Hotel not found.');
    }
    assertManagesHotel(actor, hotelId);
  }

  // The room must exist AND belong to this hotel. Reading it inside the transaction comes
  // first, so a hold saved after this point conflicts with our write (see the top of the file).
  private async findRoomOrThrow(
    hotelId: string,
    roomId: string,
    session: ClientSession,
  ): Promise<RoomDocument> {
    if (!isValidObjectId(roomId))
      throw new NotFoundException('Room not found.');
    const room = await this.roomModel
      .findOne({ _id: roomId, hotelId })
      .session(session);
    if (!room) throw new NotFoundException('Room not found.');
    return room;
  }

  // 409 if a Confirmed reservation or an unexpired hold (Pending Payment) has a night of the range.
  private async assertNoReservations(
    room: RoomDocument,
    range: NightRange,
    message: string,
  ): Promise<void> {
    const taken = await this.inventory.findTakenNights(
      [room._id],
      range.from,
      range.to,
    );
    if (taken.length > 0) {
      const nights = [...new Set(taken.map((t) => formatDate(t.night)))].sort();
      throw new ConflictException(`${message}: ${nights.join(', ')}.`);
    }
  }

  private async saveRanges(
    room: RoomDocument,
    changes: Partial<Pick<Room, 'availableRanges' | 'blockedRanges'>>,
    session: ClientSession,
  ): Promise<RoomDocument> {
    const updated = await this.roomModel.findOneAndUpdate(
      { _id: room._id },
      { $set: changes },
      { new: true, session },
    );
    if (!updated) throw new NotFoundException('Room not found.');
    return updated;
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
      // PAY-04: every price is in the platform currency.
      currency: platformCurrency(this.config),
      active: room.active,
      availableRanges: formatRanges(room.availableRanges),
      blockedRanges: formatRanges(room.blockedRanges),
      createdAt: room.get('createdAt') as Date | undefined,
      updatedAt: room.get('updatedAt') as Date | undefined,
    };
  }

  // The room's bookable and blocked ranges (same shape as HTL-04's POST response).
  private toAvailabilityResponse(room: RoomDocument) {
    return {
      roomId: room.id as string,
      roomNumber: room.roomNumber,
      availableRanges: formatRanges(room.availableRanges),
      blockedRanges: formatRanges(room.blockedRanges),
    };
  }
}
