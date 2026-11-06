// Seed script, run with: npm run seed
//
// Loads the official reference datasets in ./seed-data (countries, cities, airports,
// attractions), the supported currencies and the admin account.
// Related: PDF section 5.1, GEN-12, FLT-02, ACC-18.
//
// Safe to run more than once: reference data is upserted by its official id, and the admin
// account is only created if its email does not exist yet (an existing password is never reset).
//
// The official ids are the document _id values (EG, cairo, CAI, att-1). Field names follow
// docs/api/openapi.yaml, so the Mongoose schemas must use the same collections and fields:
//   countries   { _id: code, code, name, currency }
//   cities      { _id: cityId, cityId, name, countryCode }
//   airports    { _id: iataCode, iataCode, name, cityId, countryCode, timeZone }
//   attractions { _id: attractionId, attractionId, name, cityId }
//   currencies  { _id: code, code, name }
//   users       the admin: { name, email, passwordHash, role: 'admin', status: 'active', ... }

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import { IANAZone } from 'luxon';
import { connect, connection, disconnect } from 'mongoose';

const DATA_DIR = join(__dirname, 'seed-data');
const ENV_FILE = join(__dirname, '..', '..', '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  EGP: 'Egyptian Pound',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  JPY: 'Japanese Yen',
};

type Row = Record<string, string>;

function readCsv(file: string): Row[] {
  const lines = readFileSync(join(DATA_DIR, file), 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((key, i) => [key, (values[i] ?? '').trim()]),
    );
  });
}

// Handles quoted fields, so a name may contain commas.
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in backend/.env`);
  return value;
}

async function upsertAll(
  collection: string,
  docs: Array<{ _id: string } & Record<string, unknown>>,
) {
  if (docs.length === 0) return 0;
  await connection.db!.collection<{ _id: string }>(collection).bulkWrite(
    docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    })),
  );
  return docs.length;
}

async function seed() {
  const countries = readCsv('countries.csv').map((r) => ({
    _id: r.code,
    code: r.code,
    name: r.name,
    currency: r.currency,
  }));
  const cities = readCsv('cities.csv').map((r) => ({
    _id: r.city_id,
    cityId: r.city_id,
    name: r.name,
    countryCode: r.country_code,
  }));
  const airports = readCsv('airports.csv').map((r) => ({
    _id: r.iata_code,
    iataCode: r.iata_code,
    name: r.name,
    cityId: r.city_id,
    countryCode: r.country_code,
    // FLT-02: the official airports.csv gives each airport's IANA time zone.
    timeZone: r.time_zone,
  }));
  const attractions = readCsv('attractions.csv').map((r) => ({
    _id: r.attraction_id,
    attractionId: r.attraction_id,
    name: r.name,
    cityId: r.city_id,
  }));

  const platformCurrency = process.env.PLATFORM_CURRENCY || 'USD';
  const currencyCodes = [
    ...new Set([platformCurrency, ...countries.map((c) => c.currency)]),
  ];
  const currencies = currencyCodes.map((code) => ({
    _id: code,
    code,
    name: CURRENCY_NAMES[code] ?? code,
  }));

  // Reject inconsistent data before writing anything (GEN-12).
  const countryIds = new Set(countries.map((c) => c._id));
  const cityById = new Map(cities.map((c) => [c._id, c]));
  const problems = [
    ...cities
      .filter((c) => !countryIds.has(c.countryCode))
      .map((c) => `city ${c._id}: unknown country ${c.countryCode}`),
    ...airports
      .filter((a) => !a.timeZone || !IANAZone.isValidZone(a.timeZone))
      .map(
        (a) =>
          `airport ${a._id}: missing or unknown IANA time zone "${a.timeZone}"`,
      ),
    ...airports
      .filter((a) => !cityById.has(a.cityId))
      .map((a) => `airport ${a._id}: unknown city ${a.cityId}`),
    ...airports
      .filter(
        (a) =>
          cityById.get(a.cityId) &&
          cityById.get(a.cityId)!.countryCode !== a.countryCode,
      )
      .map(
        (a) => `airport ${a._id}: city ${a.cityId} is not in ${a.countryCode}`,
      ),
    ...attractions
      .filter((a) => !cityById.has(a.cityId))
      .map((a) => `attraction ${a._id}: unknown city ${a.cityId}`),
  ];
  if (problems.length > 0)
    throw new Error(`Seed data is inconsistent:\n  ${problems.join('\n  ')}`);

  await connect(requireEnv('MONGODB_URI'));
  const db = connection.db!;
  console.log(`Seeding database "${db.databaseName}"...`);

  const counts = {
    countries: await upsertAll('countries', countries),
    cities: await upsertAll('cities', cities),
    airports: await upsertAll('airports', airports),
    attractions: await upsertAll('attractions', attractions),
    currencies: await upsertAll('currencies', currencies),
  };

  // Admin accounts are seeded, never registered (ACC-18).
  const adminEmail = requireEnv('ADMIN_EMAIL').toLowerCase();
  const now = new Date();
  const result = await db.collection('users').updateOne(
    { email: adminEmail },
    {
      $setOnInsert: {
        name: 'Platform Admin',
        email: adminEmail,
        passwordHash: await bcrypt.hash(requireEnv('ADMIN_PASSWORD'), 12),
        role: 'admin',
        status: 'active',
        preferredCurrency: platformCurrency,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockUntil: null,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  for (const [name, count] of Object.entries(counts))
    console.log(`  ${name}: ${count}`);
  console.log(
    `  admin ${adminEmail}: ${result.upsertedCount ? 'created' : 'already exists'}`,
  );
}

seed()
  .then(() => console.log('Seed finished.'))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
