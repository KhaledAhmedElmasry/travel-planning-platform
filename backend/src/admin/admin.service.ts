import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import { BookingStatus, BookingType } from '../common/enums';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../flight-bookings/schemas/flight-booking.schema';
import {
  HotelBooking,
  HotelBookingDocument,
} from '../hotel-bookings/schemas/hotel-booking.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

export interface AdminBookingUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminBookingProvider {
  id: string;
  name: string;
  type: string;
}

export interface AdminBookingDates {
  from: string;
  to: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminBookingItem {
  id: string;
  type: BookingType;
  reference: string | null;
  user: AdminBookingUser;
  provider: AdminBookingProvider;
  dates: AdminBookingDates;
  amount: number;
  currency: string;
  status: BookingStatus;
  createdAt: Date;
}

export type LeanFlightBooking = FlightBooking & { _id: Types.ObjectId };
export type LeanHotelBooking = HotelBooking & { _id: Types.ObjectId };

export interface TaggedFlightBooking extends LeanFlightBooking {
  _type: BookingType.Flight;
}

export interface TaggedHotelBooking extends LeanHotelBooking {
  _type: BookingType.Hotel;
}

export type TaggedBooking = TaggedFlightBooking | TaggedHotelBooking;

// Area: Auth & Accounts
// Business logic and database access for: ACC-07a, ACC-13, ACC-14, ACC-15, ACC-16, ACC-17
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(FlightBooking.name)
    private readonly flightBookingModel: Model<FlightBookingDocument>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookingModel: Model<HotelBookingDocument>,
  ) {}

  // ACC-17: View a read-only list of all flight and hotel bookings, filterable by type, status, and date range
  async listBookings(
    query: ListBookingsQueryDto,
  ): Promise<PaginatedList<AdminBookingItem>> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from date must not be after to date');
    }

    const flightFilter: FilterQuery<FlightBookingDocument> = {};
    const hotelFilter: FilterQuery<HotelBookingDocument> = {};

    if (query.status) {
      flightFilter.status = query.status;
      hotelFilter.status = query.status;
    }

    if (query.from || query.to) {
      const departureFilter: Record<string, Date> = {};
      const checkInFilter: Record<string, Date> = {};

      if (query.from) {
        const fromDate = new Date(`${query.from}T00:00:00.000Z`);
        departureFilter.$gte = fromDate;
        checkInFilter.$gte = fromDate;
      }

      if (query.to) {
        const toDate = new Date(`${query.to}T23:59:59.999Z`);
        departureFilter.$lte = toDate;
        checkInFilter.$lte = toDate;
      }

      flightFilter['segments.0.departureAt'] = departureFilter;
      hotelFilter.checkIn = checkInFilter;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    if (query.type === BookingType.Flight) {
      const [flights, total] = await Promise.all([
        this.flightBookingModel
          .find(flightFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<LeanFlightBooking[]>()
          .exec(),
        this.flightBookingModel.countDocuments(flightFilter).exec(),
      ]);

      const userMap = await this.getUserMap(flights.map((f) => f.userId));
      const items = flights.map((f) => this.mapFlightBooking(f, userMap));
      return paginate(items, total, page, DEFAULT_PAGE_SIZE);
    }

    if (query.type === BookingType.Hotel) {
      const [hotels, total] = await Promise.all([
        this.hotelBookingModel
          .find(hotelFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<LeanHotelBooking[]>()
          .exec(),
        this.hotelBookingModel.countDocuments(hotelFilter).exec(),
      ]);

      const userMap = await this.getUserMap(hotels.map((h) => h.userId));
      const items = hotels.map((h) => this.mapHotelBooking(h, userMap));
      return paginate(items, total, page, DEFAULT_PAGE_SIZE);
    }

    // Both flight and hotel bookings
    const [totalFlights, totalHotels] = await Promise.all([
      this.flightBookingModel.countDocuments(flightFilter).exec(),
      this.hotelBookingModel.countDocuments(hotelFilter).exec(),
    ]);

    const total = totalFlights + totalHotels;
    if (total === 0) {
      return paginate([], 0, page, DEFAULT_PAGE_SIZE);
    }

    const fetchLimit = skip + limit;
    const [flights, hotels] = await Promise.all([
      this.flightBookingModel
        .find(flightFilter)
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean<LeanFlightBooking[]>()
        .exec(),
      this.hotelBookingModel
        .find(hotelFilter)
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean<LeanHotelBooking[]>()
        .exec(),
    ]);

    const taggedFlights: TaggedFlightBooking[] = flights.map((f) => ({
      ...f,
      _type: BookingType.Flight,
    }));
    const taggedHotels: TaggedHotelBooking[] = hotels.map((h) => ({
      ...h,
      _type: BookingType.Hotel,
    }));

    const combined: TaggedBooking[] = [...taggedFlights, ...taggedHotels].sort(
      (a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      },
    );

    const pagedSlice = combined.slice(skip, skip + limit);
    const userMap = await this.getUserMap(pagedSlice.map((b) => b.userId));

    const items = pagedSlice.map((b) => {
      if (b._type === BookingType.Flight) {
        return this.mapFlightBooking(b, userMap);
      }
      return this.mapHotelBooking(b, userMap);
    });

    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  private async getUserMap(
    userIds: (Types.ObjectId | string | undefined)[],
  ): Promise<Map<string, AdminBookingUser>> {
    const cleanIds = [
      ...new Set(userIds.filter(Boolean).map((id) => id!.toString())),
    ];
    if (cleanIds.length === 0) {
      return new Map();
    }

    const users = await this.userModel
      .find({
        _id: { $in: cleanIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('_id name email')
      .lean<{ _id: Types.ObjectId; name: string; email: string }[]>()
      .exec();

    const map = new Map<string, AdminBookingUser>();
    for (const u of users) {
      map.set(u._id.toString(), {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
      });
    }
    return map;
  }

  private mapFlightBooking(
    b: LeanFlightBooking,
    userMap: Map<string, AdminBookingUser>,
  ): AdminBookingItem {
    const userIdStr = b.userId ? b.userId.toString() : '';
    const user = userMap.get(userIdStr) ?? {
      id: userIdStr,
      name: 'Unknown',
      email: '',
    };

    const firstSeg = b.segments?.[0];
    const lastSeg =
      b.segments && b.segments.length > 0
        ? b.segments[b.segments.length - 1]
        : firstSeg;

    const fromDate = firstSeg?.departureAt
      ? new Date(firstSeg.departureAt).toISOString()
      : '';
    const toDate =
      (lastSeg?.arrivalAt ?? lastSeg?.departureAt)
        ? new Date(lastSeg.arrivalAt ?? lastSeg.departureAt).toISOString()
        : '';

    const airlineName =
      firstSeg && lastSeg && firstSeg.airlineName !== lastSeg.airlineName
        ? `${firstSeg.airlineName} / ${lastSeg.airlineName}`
        : (firstSeg?.airlineName ?? 'Unknown Airline');

    return {
      id: b._id.toString(),
      type: BookingType.Flight,
      reference: b.reference ?? null,
      user,
      provider: {
        id: firstSeg?.airlineId ? firstSeg.airlineId.toString() : '',
        name: airlineName,
        type: 'airline',
      },
      dates: {
        from: fromDate,
        to: toDate,
        startDate: fromDate ? fromDate.slice(0, 10) : undefined,
        endDate: toDate ? toDate.slice(0, 10) : undefined,
      },
      amount: b.totalAmount ?? 0,
      currency: b.currency,
      status: b.status,
      createdAt: b.createdAt ?? new Date(),
    };
  }

  private mapHotelBooking(
    b: LeanHotelBooking,
    userMap: Map<string, AdminBookingUser>,
  ): AdminBookingItem {
    const userIdStr = b.userId ? b.userId.toString() : '';
    const user = userMap.get(userIdStr) ?? {
      id: userIdStr,
      name: 'Unknown',
      email: '',
    };

    const fromDate = b.checkIn
      ? new Date(b.checkIn).toISOString().slice(0, 10)
      : '';
    const toDate = b.checkOut
      ? new Date(b.checkOut).toISOString().slice(0, 10)
      : '';

    return {
      id: b._id.toString(),
      type: BookingType.Hotel,
      reference: b.reference ?? null,
      user,
      provider: {
        id: b.hotelId ? b.hotelId.toString() : '',
        name: b.hotelName ?? 'Unknown Hotel',
        type: 'hotel',
      },
      dates: {
        from: fromDate,
        to: toDate,
        startDate: fromDate,
        endDate: toDate,
      },
      amount: b.totalAmount ?? 0,
      currency: b.currency,
      status: b.status,
      createdAt: b.createdAt ?? new Date(),
    };
  }
}
