// Requirement: FLT-17.
import { Model, Types } from 'mongoose';
import { CabinClass } from '../common/enums';
import { Flight } from './schemas/flight.schema';
import { FlightDetailsService } from './flight-details.service';

describe('FlightDetailsService', () => {
  it('returns flight, airport, cabin inventory, baggage, policy, and bookability details', async () => {
    const flightId = new Types.ObjectId();
    const airlineId = new Types.ObjectId();
    const departureAt = new Date('2099-11-02T00:30:00.000Z');
    const arrivalAt = new Date('2099-11-02T02:30:00.000Z');
    const flight = {
      _id: flightId,
      flightNumber: 'EX101',
      status: 'scheduled',
      departureAt,
      arrivalAt,
      airline: {
        _id: airlineId,
        name: 'Example Airways',
        code: 'EX',
        logoUrl: null,
        active: true,
        extraBagPrice: 5000,
        maxExtraBagsPerPassenger: 2,
        cancellationTiers: [
          { daysBefore: 7, refundPercentage: 80 },
          { daysBefore: 2, refundPercentage: 50 },
        ],
      },
      departureAirport: {
        _id: 'CAI',
        iataCode: 'CAI',
        name: 'Cairo International Airport',
        cityId: 'cairo',
        countryCode: 'EG',
        timeZone: 'Africa/Cairo',
      },
      arrivalAirport: {
        _id: 'DXB',
        iataCode: 'DXB',
        name: 'Dubai International Airport',
        cityId: 'dubai',
        countryCode: 'AE',
        timeZone: 'Asia/Dubai',
      },
      cabins: [
        {
          cabinClass: CabinClass.Economy,
          total: 20,
          booked: 5,
          held: 3,
          price: 25000,
          freeBags: 1,
          maxBagWeightKg: 23,
        },
      ],
    };
    const query = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(flight),
    };
    const findById = jest.fn().mockReturnValue(query);
    const model = { findById } as unknown as Model<Flight>;
    const service = new FlightDetailsService(model);

    await expect(service.getFlightDetails(flightId)).resolves.toEqual({
      id: flightId.toString(),
      airline: {
        id: airlineId.toString(),
        name: 'Example Airways',
        code: 'EX',
        logoUrl: null,
      },
      flightNumber: 'EX101',
      status: 'scheduled',
      departureAirport: {
        id: 'CAI',
        iataCode: 'CAI',
        name: 'Cairo International Airport',
        cityId: 'cairo',
        countryCode: 'EG',
        timeZone: 'Africa/Cairo',
      },
      arrivalAirport: {
        id: 'DXB',
        iataCode: 'DXB',
        name: 'Dubai International Airport',
        cityId: 'dubai',
        countryCode: 'AE',
        timeZone: 'Asia/Dubai',
      },
      departureLocal: '2099-11-02T02:30:00.000+02:00',
      arrivalLocal: '2099-11-02T06:30:00.000+04:00',
      departureUtc: departureAt.toISOString(),
      arrivalUtc: arrivalAt.toISOString(),
      durationMinutes: 120,
      cabins: [
        {
          category: CabinClass.Economy,
          price: 25000,
          seatsRemaining: 12,
          soldOut: false,
          freeBaggage: { bags: 1, maxWeightKgPerBag: 23 },
          extraBaggage: {
            pricePerExtraBag: 5000,
            maxExtraBagsPerPassenger: 2,
            maxWeightKgPerBag: 23,
          },
        },
      ],
      extraBaggage: {
        pricePerExtraBag: 5000,
        maxExtraBagsPerPassenger: 2,
        maxWeightKgPerBag: null,
      },
      cancellationPolicy: {
        tiers: [
          {
            daysBeforeDeparture: 7,
            refundPercentage: 80,
            description: 'Cancel 7 or more days before departure: 80% refund',
          },
          {
            daysBeforeDeparture: 2,
            refundPercentage: 50,
            description: 'Cancel 2 or more days before departure: 50% refund',
          },
        ],
        note: null,
      },
      bookable: true,
      bookableReason: null,
    });

    expect(findById).toHaveBeenCalledWith(flightId);
  });
});
