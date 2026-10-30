import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { RoomNight, RoomNightStatus } from './schemas/room-night.schema';

// Area: Payments, Holds & Booking Engine
// Requirements: HTL-17, HTL-18, HTL-21, NEW-01
// Which room is taken on which night (one RoomNight document per room and night). Every change
// is part of the caller's transaction, so a reservation and its nights always change together.
//
// For Area 7 (HTL-06 no block over reservations, HTL-08 room calendar, HTL-11 / HTL-15 free
// rooms): use findTakenNights(). Import HotelBookingsModule with forwardRef(() => ...) from
// HotelsModule, because HotelBookingsModule already imports HotelsModule.
@Injectable()
export class RoomInventoryService implements OnModuleInit {
  private readonly logger = new Logger(RoomInventoryService.name);

  constructor(
    @InjectModel(RoomNight.name)
    private readonly nightModel: Model<RoomNight>,
  ) {}

  // The unique (roomId, night) index must exist before the first hold, otherwise MongoDB would
  // accept two holds for the same night. init() waits until Mongoose has built the indexes, so
  // the app only starts once double booking is impossible.
  async onModuleInit(): Promise<void> {
    await this.nightModel.init();
  }

  // HTL-18: takes every night of every room for this reservation. Throws MongoDB's duplicate key
  // error (11000) if any of them is already held or booked: the caller's transaction is then
  // aborted, so nothing at all is held.
  async hold(
    hold: {
      bookingId: Types.ObjectId;
      hotelId: Types.ObjectId;
      roomIds: Types.ObjectId[];
      nights: Date[];
      expiresAt: Date;
      now: Date;
    },
    session: ClientSession,
  ): Promise<void> {
    const { bookingId, hotelId, roomIds, nights, expiresAt, now } = hold;
    // Holds that have ended but that the expiry job has not released yet do not block anyone
    // (NEW-01): remove them first. Their reservation can no longer be confirmed anyway.
    await this.nightModel.deleteMany(
      {
        roomId: { $in: roomIds },
        night: { $gte: nights[0], $lte: nights[nights.length - 1] },
        status: RoomNightStatus.Held,
        expiresAt: { $lte: now },
      },
      { session },
    );
    await this.nightModel.insertMany(
      roomIds.flatMap((roomId) =>
        nights.map((night) => ({
          roomId,
          hotelId,
          night,
          bookingId,
          status: RoomNightStatus.Held,
          expiresAt,
        })),
      ),
      { session },
    );
  }

  // HTL-17: held -> booked for all the reservation's nights. Returns false if not all of them
  // were still held (their hold had ended and another request took them).
  async convertHeldToBooked(
    bookingId: Types.ObjectId,
    expectedNights: number,
    session: ClientSession,
  ): Promise<boolean> {
    const result = await this.nightModel.updateMany(
      { bookingId, status: RoomNightStatus.Held },
      { $set: { status: RoomNightStatus.Booked, expiresAt: null } },
      { session },
    );
    if (result.modifiedCount !== expectedNights) {
      this.logger.error(
        `Reservation ${bookingId.toString()}: ${result.modifiedCount} of ${expectedNights} held room-nights found.`,
      );
      return false;
    }
    return true;
  }

  // Hold expired (HTL-18, NEW-01): the held nights are free again. Some may already be gone if a
  // later hold removed them (see hold()); that is fine.
  async releaseHeld(
    bookingId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.nightModel.deleteMany(
      { bookingId, status: RoomNightStatus.Held },
      { session },
    );
  }

  // Reservation cancelled (HTL-21): all its rooms are free again for those dates.
  async releaseBooked(
    bookingId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.nightModel.deleteMany(
      { bookingId, status: RoomNightStatus.Booked },
      { session },
    );
  }

  // For Area 7: the nights from firstNight to lastNight (both included, dates at 00:00 UTC) on
  // which these rooms are taken by a Confirmed reservation or an unexpired hold. A room is free
  // for a stay if none of its stay nights is in the result. bookingId gives the reservation (its
  // reference for the HTL-08 calendar).
  findTakenNights(
    roomIds: (string | Types.ObjectId)[],
    firstNight: Date,
    lastNight: Date,
    now = new Date(),
  ): Promise<
    {
      roomId: Types.ObjectId;
      night: Date;
      bookingId: Types.ObjectId;
      status: RoomNightStatus;
    }[]
  > {
    return this.nightModel
      .find({
        roomId: { $in: roomIds.map((id) => new Types.ObjectId(id)) },
        night: { $gte: firstNight, $lte: lastNight },
        $or: [
          { status: RoomNightStatus.Booked },
          { status: RoomNightStatus.Held, expiresAt: { $gt: now } },
        ],
      })
      .select({ roomId: 1, night: 1, bookingId: 1, status: 1, _id: 0 })
      .lean();
  }
}
