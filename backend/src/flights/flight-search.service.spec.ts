// Requirements: FLT-11, FLT-12, FLT-15, GEN-02, GEN-04, GEN-05, GEN-06.
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { CabinClass } from '../common/enums';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto';
import { FlightSearchService } from './flight-search.service';
import { Airline } from './placeholders/airline.schema';
import { Airport } from './placeholders/airport.schema';
import { Flight, FlightCabin } from './schemas/flight.schema';

type PopulatedAirline = Pick<Airline, 'name' | 'logoUrl' | 'active'> & {
  _id: Types.ObjectId;
};
type SearchFlight = Omit<Flight, 'airline'> & {
  _id: Types.ObjectId;
  airline: PopulatedAirline | null;
};
type SearchAirport = Airport & { _id: string };

const cairo: SearchAirport = {
  _id: 'CAI',
  iataCode: 'CAI',
  name: 'Cairo International Airport',
  cityId: 'cairo',
  countryCode: 'EG',
  timeZone: 'Africa/Cairo',
};
const dubai: SearchAirport = {
  _id: 'DXB',
  iataCode: 'DXB',
  name: 'Dubai International Airport',
  cityId: 'dubai',
  countryCode: 'AE',
  timeZone: 'Asia/Dubai',
};
const activeAirline: PopulatedAirline = {
  _id: new Types.ObjectId(),
  name: 'Example Airways',
  logoUrl: null,
  active: true,
};

function makeFlight(
  flightNumber: string,
  departureAt: string,
  cabins: FlightCabin[],
  airline: PopulatedAirline | null = activeAirline,
  origin = 'CAI',
  destination = 'DXB',
): SearchFlight {
  const departure = new Date(departureAt);
  return {
    _id: new Types.ObjectId(),
    flightNumber,
    airline,
    departureAirport: origin,
    arrivalAirport: destination,
    departureAt: departure,
    arrivalAt: new Date(departure.getTime() + 2 * 60 * 60 * 1000),
    status: 'scheduled',
    cabins,
  };
}

function cabin(
  cabinClass: CabinClass,
  total: number,
  price = 25000,
  booked = 0,
  held = 0,
): FlightCabin {
  return {
    cabinClass,
    total,
    booked,
    held,
    price,
    freeBags: 1,
    maxBagWeightKg: 23,
  };
}

function createSearchService(
  returnedFlights: SearchFlight[],
  returnFlights?: SearchFlight[],
) {
  const airports = new Map([
    [cairo.iataCode, cairo],
    [dubai.iataCode, dubai],
  ]);
  const airportModel = {
    findOne: jest.fn(({ iataCode }: { iataCode: string }) => ({
      lean: () => ({
        exec: () => Promise.resolve(airports.get(iataCode) ?? null),
      }),
    })),
  };
  let flightSearchCount = 0;
  const flightQuery = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          flightSearchCount++ === 0
            ? returnedFlights
            : (returnFlights ?? returnedFlights),
        ),
      ),
  };
  const filters: Record<string, unknown>[] = [];
  const findFlights = jest.fn((filter: Record<string, unknown>) => {
    filters.push(filter);
    return flightQuery;
  });
  const service = new FlightSearchService(
    airportModel as unknown as Model<Airport>,
    { find: findFlights } as unknown as Model<Flight>,
  );
  return { service, airportModel, findFlights, flightQuery, filters };
}

const validQuery = {
  origin: 'CAI',
  destination: 'DXB',
  departureDate: '2099-11-02',
  adults: 2,
  page: 1,
};

describe('FlightSearchService', () => {
  it('uses the departure airport timezone and the agreed flight inventory fields', async () => {
    const flight = makeFlight('EX101', '2099-11-01T22:30:00.000Z', [
      cabin(CabinClass.Economy, 5, 25000, 1, 1),
      cabin(CabinClass.Business, 1),
    ]);
    const { service, filters } = createSearchService([flight]);

    const result = await service.search(validQuery);

    expect(result.total).toBe(1);
    expect(result.items[0].departureLocal).toBe(
      '2099-11-02T00:30:00.000+02:00',
    );
    expect(result.items[0].arrivalLocal).toBe('2099-11-02T04:30:00.000+04:00');
    expect(result.items[0].cabins.map(({ category }) => category)).toEqual([
      CabinClass.Economy,
    ]);
    expect(result.items[0].cabins[0].availableSeats).toBe(3);

    const filter = filters[0];
    expect(filter.status).toBe('scheduled');
    const departureAt = filter.departureAt;
    expect(departureAt).toEqual(
      expect.objectContaining({
        $gte: new Date('2099-11-01T22:00:00.000Z'),
        $lt: new Date('2099-11-02T22:00:00.000Z'),
      }),
    );
    if (typeof departureAt !== 'object' || departureAt === null) {
      throw new Error('Expected departureAt to be a range filter.');
    }
    expect((departureAt as Record<string, unknown>).$gt).toBeInstanceOf(Date);
  });

  it('filters by cabin fare rather than passenger total', async () => {
    const { service } = createSearchService([
      makeFlight('EX102', '2099-11-02T05:00:00.000Z', [
        cabin(CabinClass.Economy, 5, 25000),
      ]),
    ]);

    await expect(
      service.search({
        ...validQuery,
        minPrice: 25000,
        maxPrice: 25000,
      }),
    ).resolves.toMatchObject({
      total: 1,
      items: [{ cabins: [{ price: 25000, totalPrice: 50000 }] }],
    });
  });

  it('excludes flights with no seats or an inactive airline', async () => {
    const { service } = createSearchService([
      makeFlight('EX103', '2099-11-02T05:00:00.000Z', [
        cabin(CabinClass.Economy, 2, 25000, 1, 1),
      ]),
      makeFlight(
        'EX104',
        '2099-11-02T06:00:00.000Z',
        [cabin(CabinClass.Economy, 5)],
        null,
      ),
    ]);

    await expect(service.search(validQuery)).resolves.toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
      message: 'No flights found for your search.',
    });
  });

  it('rejects unknown and identical airports', async () => {
    const { service } = createSearchService([]);

    await expect(
      service.search({ ...validQuery, origin: 'ZZZ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.search({ ...validQuery, destination: 'CAI' }),
    ).rejects.toThrow('Departure and arrival airports must be different.');
  });

  it('returns outbound and return options for round-trip search', async () => {
    const outbound = makeFlight('EX105', '2099-11-02T05:00:00.000Z', [
      cabin(CabinClass.Economy, 5),
    ]);
    const inbound = makeFlight(
      'EX106',
      '2099-11-03T05:00:00.000Z',
      [cabin(CabinClass.Economy, 5)],
      activeAirline,
      'DXB',
      'CAI',
    );
    const { service, findFlights, filters } = createSearchService(
      [outbound],
      [inbound],
    );

    const result = await service.search({
      ...validQuery,
      tripType: 'round_trip' as const,
      returnDate: '2099-11-03',
    });

    expect(result).toMatchObject({
      tripType: 'round_trip',
      outbound: { items: [{ flightNumber: 'EX105' }] },
      return: { items: [{ flightNumber: 'EX106' }] },
    });
    expect(findFlights).toHaveBeenCalledTimes(2);
    expect(filters[1]).toEqual(
      expect.objectContaining({
        departureAirport: dubai._id,
        arrivalAirport: cairo._id,
      }),
    );
  });
});

describe('FlightSearchQueryDto', () => {
  it('normalizes airport codes and defaults documented optional fields', async () => {
    const dto = plainToInstance(FlightSearchQueryDto, {
      origin: ' cai ',
      destination: 'dxb',
      departureDate: '2099-11-02',
    });

    expect(dto.origin).toBe('CAI');
    expect(dto.destination).toBe('DXB');
    expect(dto.adults).toBe(1);
    expect(dto.tripType).toBe('one_way');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects undocumented aliases and invalid dates/prices', async () => {
    const aliasDto = plainToInstance(FlightSearchQueryDto, {
      from: 'CAI',
      to: 'DXB',
      date: '2099-11-02',
    });
    const invalidDto = plainToInstance(FlightSearchQueryDto, {
      ...validQuery,
      departureDate: '2099-02-31',
      minPrice: '1.5',
    });

    expect((await validate(aliasDto)).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['origin', 'destination', 'departureDate']),
    );
    expect(
      (await validate(invalidDto)).map(({ property }) => property),
    ).toEqual(expect.arrayContaining(['departureDate', 'minPrice']));
  });
});
