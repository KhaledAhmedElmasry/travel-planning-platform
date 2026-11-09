import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Connection, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';
import { ROLES_KEY } from '../common/decorators';
import { BookingStatus, ProviderType, Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  FlightBooking,
  FlightBookingDocument,
} from '../flight-bookings/schemas/flight-booking.schema';
import {
  HotelBooking,
  HotelBookingDocument,
} from '../hotel-bookings/schemas/hotel-booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UserDocument } from '../users/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminAnalyticsResponse, AdminService } from './admin.service';
import {
  AnalyticsDateFilterBy,
  AnalyticsQueryDto,
} from './dto/analytics-query.dto';

describe('Admin Analytics Dashboard (BON-01)', () => {
  const airlineId1 = new Types.ObjectId('665f1c2a9b1e8a0012340001');
  const airlineId2 = new Types.ObjectId('665f1c2a9b1e8a0012340002');
  const hotelId1 = new Types.ObjectId('665f1c2a9b1e8a0012340003');

  function createMockFlightBookings(): LeanFlightBookingDoc[] {
    return [
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        status: BookingStatus.Confirmed,
        totalAmount: 15000,
        currency: 'USD',
        createdAt: new Date('2026-05-10T10:00:00Z'),
        segments: [
          {
            flightId: new Types.ObjectId(),
            flightNumber: 'MS101',
            airlineId: airlineId1,
            airlineName: 'EgyptAir',
            departureAt: new Date('2026-06-01T08:00:00Z'),
            arrivalAt: new Date('2026-06-01T12:00:00Z'),
          },
        ],
      },
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        status: BookingStatus.Completed,
        totalAmount: 20000,
        currency: 'USD',
        createdAt: new Date('2026-05-15T12:00:00Z'),
        segments: [
          {
            flightId: new Types.ObjectId(),
            flightNumber: 'MS102',
            airlineId: airlineId1,
            airlineName: 'EgyptAir',
            departureAt: new Date('2026-05-20T08:00:00Z'),
            arrivalAt: new Date('2026-05-20T12:00:00Z'),
          },
        ],
      },
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        status: BookingStatus.Cancelled,
        totalAmount: 10000,
        currency: 'USD',
        createdAt: new Date('2026-05-18T14:00:00Z'),
        segments: [
          {
            flightId: new Types.ObjectId(),
            flightNumber: 'EK201',
            airlineId: airlineId2,
            airlineName: 'Emirates',
            departureAt: new Date('2026-07-01T10:00:00Z'),
            arrivalAt: new Date('2026-07-01T14:00:00Z'),
          },
        ],
      },
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        status: BookingStatus.PendingPayment,
        totalAmount: 12000,
        currency: 'USD',
        createdAt: new Date('2026-05-19T09:00:00Z'),
        segments: [
          {
            flightId: new Types.ObjectId(),
            flightNumber: 'EK202',
            airlineId: airlineId2,
            airlineName: 'Emirates',
            departureAt: new Date('2026-07-10T10:00:00Z'),
            arrivalAt: new Date('2026-07-10T14:00:00Z'),
          },
        ],
      },
    ] as unknown as LeanFlightBookingDoc[];
  }

  function createMockHotelBookings(): LeanHotelBookingDoc[] {
    return [
      {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        hotelId: hotelId1,
        hotelName: 'Nile Palace Hotel',
        checkIn: new Date('2026-06-15T00:00:00Z'),
        checkOut: new Date('2026-06-20T00:00:00Z'),
        totalAmount: 50000,
        currency: 'USD',
        status: BookingStatus.Confirmed,
        createdAt: new Date('2026-05-12T16:00:00Z'),
      },
    ] as unknown as LeanHotelBookingDoc[];
  }

  type LeanFlightBookingDoc = FlightBooking & { _id: Types.ObjectId };
  type LeanHotelBookingDoc = HotelBooking & { _id: Types.ObjectId };

  function setupService(options?: {
    flightDocs?: LeanFlightBookingDoc[];
    hotelDocs?: LeanHotelBookingDoc[];
    airlines?: Array<{ _id: Types.ObjectId; name: string }>;
    hotels?: Array<{ _id: Types.ObjectId; name: string }>;
  }) {
    const flightDocs = options?.flightDocs ?? createMockFlightBookings();
    const hotelDocs = options?.hotelDocs ?? createMockHotelBookings();
    const seededAirlines = options?.airlines ?? [
      { _id: airlineId1, name: 'EgyptAir' },
      { _id: airlineId2, name: 'Emirates' },
    ];
    const seededHotels = options?.hotels ?? [
      { _id: hotelId1, name: 'Nile Palace Hotel' },
    ];

    const flightFindMock = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(flightDocs),
      }),
    });
    const flightBookingModel = {
      find: flightFindMock,
    } as unknown as Model<FlightBookingDocument>;

    const hotelFindMock = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(hotelDocs),
      }),
    });
    const hotelBookingModel = {
      find: hotelFindMock,
    } as unknown as Model<HotelBookingDocument>;

    const userModel = {} as Model<UserDocument>;
    const sessionsService = {} as SessionsService;
    const notificationsService = {} as NotificationsService;
    const auditService = {} as unknown as AuditService;

    const mockAirlinesCollection = {
      find: jest.fn().mockReturnValue({
        project: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(seededAirlines),
        }),
      }),
    };

    const mockHotelsCollection = {
      find: jest.fn().mockReturnValue({
        project: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(seededHotels),
        }),
      }),
    };

    const connection = {
      db: {
        collection: jest.fn((name: string) => {
          if (name === 'airlines') return mockAirlinesCollection;
          if (name === 'hotels') return mockHotelsCollection;
          return null;
        }),
      },
    } as unknown as Connection;

    const configService = {
      get: jest.fn((key: string) =>
        key === 'PLATFORM_CURRENCY' ? 'USD' : null,
      ),
    } as unknown as ConfigService;

    const service = new AdminService(
      userModel,
      connection,
      sessionsService,
      notificationsService,
      auditService,
      flightBookingModel,
      hotelBookingModel,
      configService,
    );

    return {
      service,
      flightFindMock,
      hotelFindMock,
      flightDocs,
      hotelDocs,
    };
  }

  describe('AdminController route security & metadata', () => {
    it('applies JwtAuthGuard and RolesGuard on AdminController', () => {
      const reflector = new Reflector();
      const guards = reflector.get<unknown[]>(GUARDS_METADATA, AdminController);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('requires Role.Admin on AdminController', () => {
      const reflector = new Reflector();
      const roles = reflector.get<unknown[]>(ROLES_KEY, AdminController);
      expect(roles).toEqual([Role.Admin]);
    });

    it('delegates getAnalytics to AdminService.getAnalytics', async () => {
      const { service } = setupService();
      const controller = new AdminController(service);
      const spy = jest
        .spyOn(service, 'getAnalytics')
        .mockResolvedValue({} as unknown as AdminAnalyticsResponse);

      const query: AnalyticsQueryDto = { from: '2026-01-01', to: '2026-12-31' };
      await controller.getAnalytics(query);

      expect(spy).toHaveBeenCalledWith(query);
    });
  });

  describe('AdminService.getAnalytics', () => {
    it('throws BadRequestException if from date is after to date', async () => {
      const { service } = setupService();
      await expect(
        service.getAnalytics({ from: '2026-12-31', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns overall summary and per-provider breakdown', async () => {
      const { service } = setupService();
      const result = await service.getAnalytics({});

      expect(result.summary).toBeDefined();
      expect(result.summary.currency).toBe('USD');
      // EgyptAir: 1 confirmed (15000), 1 completed (20000) = 35000 rev, 2 bookings
      // Emirates: 1 cancelled (0 rev), 1 pending (0 rev) = 0 rev, 2 bookings
      // Nile Palace: 1 confirmed (50000) = 50000 rev, 1 booking
      // Total revenue = 35000 + 50000 = 85000
      // Total bookings = 4 flights + 1 hotel = 5 bookings
      expect(result.summary.totalBookings).toBe(5);
      expect(result.summary.confirmedBookings).toBe(2);
      expect(result.summary.completedBookings).toBe(1);
      expect(result.summary.cancelledBookings).toBe(1);
      expect(result.summary.pendingBookings).toBe(1);
      expect(result.summary.totalRevenue).toBe(85000);

      // Providers array should be sorted by revenue descending
      expect(result.providers).toHaveLength(3);
      expect(result.items).toEqual(result.providers);

      // Top revenue is Nile Palace Hotel ($500.00 / 50000 cents)
      expect(result.providers[0].providerName).toBe('Nile Palace Hotel');
      expect(result.providers[0].providerType).toBe(ProviderType.Hotel);
      expect(result.providers[0].totalRevenue).toBe(50000);
      expect(result.providers[0].totalBookings).toBe(1);

      // Second is EgyptAir ($350.00 / 35000 cents)
      expect(result.providers[1].providerName).toBe('EgyptAir');
      expect(result.providers[1].providerType).toBe(ProviderType.Airline);
      expect(result.providers[1].totalRevenue).toBe(35000);
      expect(result.providers[1].totalBookings).toBe(2);

      // Third is Emirates ($0 revenue, 2 bookings)
      expect(result.providers[2].providerName).toBe('Emirates');
      expect(result.providers[2].totalRevenue).toBe(0);
      expect(result.providers[2].totalBookings).toBe(2);
      expect(result.providers[2].cancelledBookings).toBe(1);
      expect(result.providers[2].pendingBookings).toBe(1);
    });

    it('filters by providerType = airline', async () => {
      const { service, hotelFindMock } = setupService();
      const result = await service.getAnalytics({ type: ProviderType.Airline });

      expect(hotelFindMock).not.toHaveBeenCalled();
      expect(
        result.providers.every((p) => p.providerType === ProviderType.Airline),
      ).toBe(true);
      expect(result.summary.totalBookings).toBe(4);
      expect(result.summary.totalRevenue).toBe(35000);
    });

    it('filters by providerType = hotel', async () => {
      const { service, flightFindMock } = setupService();
      const result = await service.getAnalytics({ type: ProviderType.Hotel });

      expect(flightFindMock).not.toHaveBeenCalled();
      expect(
        result.providers.every((p) => p.providerType === ProviderType.Hotel),
      ).toBe(true);
      expect(result.summary.totalBookings).toBe(1);
      expect(result.summary.totalRevenue).toBe(50000);
    });

    it('filters by providerId', async () => {
      const { service } = setupService();
      const result = await service.getAnalytics({
        providerId: airlineId1.toString(),
      });

      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].providerId).toBe(airlineId1.toString());
      expect(result.providers[0].providerName).toBe('EgyptAir');
      expect(result.summary.totalBookings).toBe(2);
      expect(result.summary.totalRevenue).toBe(35000);
    });

    it('filters by date range using dateBy = travel vs dateBy = created', async () => {
      const { service, flightFindMock } = setupService();

      await service.getAnalytics({
        from: '2026-06-01',
        to: '2026-06-30',
        dateBy: AnalyticsDateFilterBy.Travel,
      });

      expect(flightFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          'segments.0.departureAt': {
            $gte: new Date('2026-06-01T00:00:00.000Z'),
            $lte: new Date('2026-06-30T23:59:59.999Z'),
          },
        }),
      );

      await service.getAnalytics({
        from: '2026-05-01',
        to: '2026-05-31',
        dateBy: AnalyticsDateFilterBy.Created,
      });

      expect(flightFindMock).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: {
            $gte: new Date('2026-05-01T00:00:00.000Z'),
            $lte: new Date('2026-05-31T23:59:59.999Z'),
          },
        }),
      );
    });

    it('returns empty list and 0 summary when no providers match (GEN-04)', async () => {
      const { service } = setupService({
        flightDocs: [],
        hotelDocs: [],
        airlines: [],
        hotels: [],
      });

      const result = await service.getAnalytics({});

      expect(result.items).toEqual([]);
      expect(result.providers).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.summary.totalBookings).toBe(0);
      expect(result.summary.totalRevenue).toBe(0);
    });

    it('paginates providers with page size 10 (GEN-05)', async () => {
      const seededAirlines = Array.from({ length: 15 }, (_, i) => ({
        _id: new Types.ObjectId(),
        name: `Airline ${i + 1}`,
      }));

      const { service } = setupService({
        flightDocs: [],
        hotelDocs: [],
        airlines: seededAirlines,
        hotels: [],
      });

      const page1 = await service.getAnalytics({ page: 1 });
      expect(page1.items).toHaveLength(10);
      expect(page1.page).toBe(1);
      expect(page1.total).toBe(15);
      expect(page1.totalPages).toBe(2);

      const page2 = await service.getAnalytics({ page: 2 });
      expect(page2.items).toHaveLength(5);
      expect(page2.page).toBe(2);
      expect(page2.total).toBe(15);
      expect(page2.totalPages).toBe(2);
    });
  });
});
