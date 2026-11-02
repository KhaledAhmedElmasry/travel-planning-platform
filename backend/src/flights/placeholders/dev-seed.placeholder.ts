// TODO(AREA-5): PLACEHOLDER until Area 5 owns flight development seeding. Replace this standalone seed script and delete this file.
// Requirements: FLT-02, FLT-03, FLT-04, FLT-11.
import mongoose from 'mongoose';
import { Airline, AirlineSchema } from './airline.schema';
import { Airport, AirportSchema } from './airport.schema';
import { Flight, FlightSchema } from './flight.schema';

const AIRPORTS = [
  {
    iataCode: 'CAI',
    name: 'Cairo International Airport',
    city: 'Cairo',
    country: 'Egypt',
    timeZone: 'Africa/Cairo',
  },
  {
    iataCode: 'DXB',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    timeZone: 'Asia/Dubai',
  },
] as const;

async function seedDevelopmentFlights(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI must be set before running the flight seed.');
  }

  await mongoose.connect(uri);
  const airportModel = mongoose.model(Airport.name, AirportSchema);
  const airlineModel = mongoose.model(Airline.name, AirlineSchema);
  const flightModel = mongoose.model(Flight.name, FlightSchema);

  try {
    for (const airport of AIRPORTS) {
      await airportModel.updateOne(
        { _id: airport.iataCode },
        { $set: airport },
        { upsert: true },
      );
    }

    await airlineModel.updateOne(
      { name: 'Example Airways' },
      {
        $set: {
          name: 'Example Airways',
          logoUrl: 'https://example.com/example-airways.png',
          isActive: true,
        },
      },
      { upsert: true },
    );
    await airlineModel.updateOne(
      { name: 'Inactive Demo Air' },
      {
        $set: {
          name: 'Inactive Demo Air',
          logoUrl: 'https://example.com/inactive-demo-air.png',
          isActive: false,
        },
      },
      { upsert: true },
    );

    const [cairo, dubai, activeAirline, inactiveAirline] = await Promise.all([
      airportModel.findOne({ iataCode: 'CAI' }).lean().exec(),
      airportModel.findOne({ iataCode: 'DXB' }).lean().exec(),
      airlineModel.findOne({ name: 'Example Airways' }).lean().exec(),
      airlineModel.findOne({ name: 'Inactive Demo Air' }).lean().exec(),
    ]);
    if (!cairo || !dubai || !activeAirline || !inactiveAirline) {
      throw new Error('Could not reload the airport and airline seed records.');
    }

    const flights = [
      // CAI-local 00:30 on November 2, even though its UTC date is still November 1.
      {
        flightNumber: 'EX101',
        airline: activeAirline._id,
        departureAirport: cairo._id,
        arrivalAirport: dubai._id,
        departureUtc: new Date('2026-11-01T22:30:00.000Z'),
        arrivalUtc: new Date('2026-11-02T00:30:00.000Z'),
        status: 'Scheduled',
        cabins: [
          {
            category: 'Economy',
            seatCount: 6,
            price: 25000,
            freeBags: 1,
            maxBagWeightKg: 23,
          },
          {
            category: 'Business',
            seatCount: 12,
            price: 80000,
            freeBags: 2,
            maxBagWeightKg: 32,
          },
        ],
      },
      {
        flightNumber: 'EX102',
        airline: activeAirline._id,
        departureAirport: cairo._id,
        arrivalAirport: dubai._id,
        departureUtc: new Date('2026-11-02T05:00:00.000Z'),
        arrivalUtc: new Date('2026-11-02T07:00:00.000Z'),
        status: 'Scheduled',
        cabins: [
          {
            category: 'Economy',
            seatCount: 2,
            price: 22000,
            freeBags: 1,
            maxBagWeightKg: 20,
          },
          {
            category: 'Business',
            seatCount: 4,
            price: 70000,
            freeBags: 2,
            maxBagWeightKg: 30,
          },
        ],
      },
      {
        flightNumber: 'EX103',
        airline: activeAirline._id,
        departureAirport: cairo._id,
        arrivalAirport: dubai._id,
        departureUtc: new Date('2026-11-02T08:00:00.000Z'),
        arrivalUtc: new Date('2026-11-02T10:00:00.000Z'),
        status: 'Cancelled',
        cabins: [
          {
            category: 'Economy',
            seatCount: 20,
            price: 20000,
            freeBags: 1,
            maxBagWeightKg: 20,
          },
        ],
      },
      {
        flightNumber: 'EX104',
        airline: inactiveAirline._id,
        departureAirport: cairo._id,
        arrivalAirport: dubai._id,
        departureUtc: new Date('2026-11-02T11:00:00.000Z'),
        arrivalUtc: new Date('2026-11-02T13:00:00.000Z'),
        status: 'Scheduled',
        cabins: [
          {
            category: 'Economy',
            seatCount: 20,
            price: 18000,
            freeBags: 1,
            maxBagWeightKg: 20,
          },
        ],
      },
    ] as const;

    for (const flight of flights) {
      await flightModel.updateOne(
        {
          flightNumber: flight.flightNumber,
          airline: flight.airline,
        },
        { $set: flight },
        { upsert: true },
      );
    }
    console.log('Development flight search data upserted.');
  } finally {
    await mongoose.disconnect();
  }
}

void seedDevelopmentFlights().catch((error: unknown) => {
  console.error('Could not seed development flight search data.', error);
  process.exitCode = 1;
});
