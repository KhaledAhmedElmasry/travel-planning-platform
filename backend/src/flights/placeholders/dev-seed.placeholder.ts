// Requirement: FLT-12.
// Manual development seed only; run with ts-node, never from application bootstrap.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { connect, connection, disconnect, Types } from 'mongoose';

const ENV_FILE = join(__dirname, '..', '..', '..', '.env');
const ACTIVE_AIRLINE_ID = new Types.ObjectId('665f1c2a9b1e8a0012340101');
const INACTIVE_AIRLINE_ID = new Types.ObjectId('665f1c2a9b1e8a0012340102');
const DEMO_FLIGHTS = [
  {
    _id: new Types.ObjectId('665f1c2a9b1e8a0012340201'),
    flightNumber: 'EX101',
    airline: ACTIVE_AIRLINE_ID,
    departureAirport: 'CAI',
    arrivalAirport: 'DXB',
    departureUtc: new Date('2026-11-01T22:30:00.000Z'),
    arrivalUtc: new Date('2026-11-02T00:30:00.000Z'),
    status: 'Scheduled',
    cabins: [
      {
        category: 'Economy',
        seatCount: 20,
        price: 25000,
        freeBags: 1,
        maxBagWeightKg: 23,
      },
      {
        category: 'Business',
        seatCount: 4,
        price: 75000,
        freeBags: 2,
        maxBagWeightKg: 32,
      },
    ],
  },
  {
    _id: new Types.ObjectId('665f1c2a9b1e8a0012340202'),
    flightNumber: 'EX102',
    airline: ACTIVE_AIRLINE_ID,
    departureAirport: 'CAI',
    arrivalAirport: 'DXB',
    departureUtc: new Date('2026-11-02T08:00:00.000Z'),
    arrivalUtc: new Date('2026-11-02T10:00:00.000Z'),
    status: 'Scheduled',
    cabins: [
      {
        category: 'Economy',
        seatCount: 3,
        price: 22000,
        freeBags: 1,
        maxBagWeightKg: 23,
      },
    ],
  },
  {
    _id: new Types.ObjectId('665f1c2a9b1e8a0012340203'),
    flightNumber: 'EX201',
    airline: ACTIVE_AIRLINE_ID,
    departureAirport: 'DXB',
    arrivalAirport: 'CAI',
    departureUtc: new Date('2026-11-02T21:00:00.000Z'),
    arrivalUtc: new Date('2026-11-02T23:00:00.000Z'),
    status: 'Scheduled',
    cabins: [
      {
        category: 'Economy',
        seatCount: 20,
        price: 25000,
        freeBags: 1,
        maxBagWeightKg: 23,
      },
      {
        category: 'Business',
        seatCount: 4,
        price: 75000,
        freeBags: 2,
        maxBagWeightKg: 32,
      },
    ],
  },
  {
    _id: new Types.ObjectId('665f1c2a9b1e8a0012340204'),
    flightNumber: 'EX301',
    airline: ACTIVE_AIRLINE_ID,
    departureAirport: 'CAI',
    arrivalAirport: 'DXB',
    departureUtc: new Date('2026-11-02T12:00:00.000Z'),
    arrivalUtc: new Date('2026-11-02T14:00:00.000Z'),
    status: 'Cancelled',
    cabins: [
      {
        category: 'Economy',
        seatCount: 20,
        price: 20000,
        freeBags: 1,
        maxBagWeightKg: 23,
      },
    ],
  },
  {
    _id: new Types.ObjectId('665f1c2a9b1e8a0012340205'),
    flightNumber: 'EX401',
    airline: INACTIVE_AIRLINE_ID,
    departureAirport: 'CAI',
    arrivalAirport: 'DXB',
    departureUtc: new Date('2026-11-02T14:00:00.000Z'),
    arrivalUtc: new Date('2026-11-02T16:00:00.000Z'),
    status: 'Scheduled',
    cabins: [
      {
        category: 'Economy',
        seatCount: 20,
        price: 21000,
        freeBags: 1,
        maxBagWeightKg: 23,
      },
    ],
  },
  {
    _id: new Types.ObjectId('665f1c2a9b1e8a0012340206'),
    flightNumber: 'EX103',
    airline: ACTIVE_AIRLINE_ID,
    departureAirport: 'CAI',
    arrivalAirport: 'DXB',
    departureUtc: new Date('2026-11-02T10:00:00.000Z'),
    arrivalUtc: new Date('2026-11-02T13:15:00.000Z'),
    status: 'Scheduled',
    cabins: [
      {
        category: 'Economy',
        seatCount: 20,
        price: 18000,
        freeBags: 1,
        maxBagWeightKg: 23,
      },
    ],
  },
];

async function seedDevelopmentFlights(): Promise<void> {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI must be set to run the development flight seed.',
    );
  }
  await connect(uri);
  const database = connection.db;
  if (!database) {
    throw new Error('MongoDB connection did not expose a database.');
  }

  await database.collection<{ _id: string }>('airports').bulkWrite([
    {
      updateOne: {
        filter: { _id: 'CAI' },
        update: {
          $set: {
            iataCode: 'CAI',
            name: 'Cairo International Airport',
            city: 'Cairo',
            country: 'Egypt',
            timeZone: 'Africa/Cairo',
          },
        },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { _id: 'DXB' },
        update: {
          $set: {
            iataCode: 'DXB',
            name: 'Dubai International Airport',
            city: 'Dubai',
            country: 'United Arab Emirates',
            timeZone: 'Asia/Dubai',
          },
        },
        upsert: true,
      },
    },
  ]);
  await database.collection('airlines').bulkWrite([
    {
      updateOne: {
        filter: { _id: ACTIVE_AIRLINE_ID },
        update: {
          $set: {
            name: 'Example Airways',
            logoUrl: null,
            isActive: true,
          },
        },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { _id: INACTIVE_AIRLINE_ID },
        update: {
          $set: {
            name: 'Inactive Demo Airways',
            logoUrl: null,
            isActive: false,
          },
        },
        upsert: true,
      },
    },
  ]);
  await database.collection('flights').bulkWrite(
    DEMO_FLIGHTS.map((flight) => ({
      replaceOne: {
        filter: { _id: flight._id },
        replacement: flight,
        upsert: true,
      },
    })),
  );
  console.log('Development airports, airlines, and flights were upserted.');
}

if (require.main === module) {
  seedDevelopmentFlights()
    .catch((error: unknown) => {
      console.error('Development flight seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => disconnect());
}
