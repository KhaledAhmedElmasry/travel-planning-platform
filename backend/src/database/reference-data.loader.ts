// Reads and validates the official reference datasets in ./seed-data (GEN-12, FLT-02, NEW-05).
//
// Pure file-reading code with no database access, so it can be unit tested. The seed script
// (seed.ts) calls loadReferenceData() and writes the result to MongoDB.

import { readFileSync } from 'fs';
import { join } from 'path';
import { IANAZone } from 'luxon';

const DEFAULT_DATA_DIR = join(__dirname, 'seed-data');

// airports.csv has no time-zone column, but FLT-02 requires an IANA time zone per airport.
// When the official dataset gets a new airport, add its zone here, otherwise the seed stops
// with a clear message instead of storing an airport without a zone.
export const AIRPORT_TIME_ZONES: Record<string, string> = {
  CAI: 'Africa/Cairo',
  DXB: 'Asia/Dubai',
  LHR: 'Europe/London',
  JFK: 'America/New_York',
  CDG: 'Europe/Paris',
  HND: 'Asia/Tokyo',
  RUH: 'Asia/Riyadh',
};

// Display names of the supported currencies. A code missing here falls back to the name from
// the Intl API, then to the code itself.
export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  EGP: 'Egyptian Pound',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  JPY: 'Japanese Yen',
};

export type CountryRecord = {
  _id: string;
  code: string;
  name: string;
  currency: string;
};
export type CityRecord = {
  _id: string;
  cityId: string;
  name: string;
  countryCode: string;
};
export type AirportRecord = {
  _id: string;
  iataCode: string;
  name: string;
  cityId: string;
  countryCode: string;
  timeZone: string;
};
export type AttractionRecord = {
  _id: string;
  attractionId: string;
  name: string;
  cityId: string;
};
export type CurrencyRecord = {
  _id: string;
  code: string;
  name: string;
};
export type ReferenceData = {
  countries: CountryRecord[];
  cities: CityRecord[];
  airports: AirportRecord[];
  attractions: AttractionRecord[];
  currencies: CurrencyRecord[];
};

type Row = Record<string, string>;

export function readCsv(file: string, dataDir = DEFAULT_DATA_DIR): Row[] {
  const text = readFileSync(join(dataDir, file), 'utf-8').replace(
    /^\uFEFF/,
    '',
  );
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new Error(`${file} is empty`);
  const header = parseCsvLine(lines[0]).map((key) => key.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((key, i) => [key, (values[i] ?? '').trim()]),
    );
  });
}

// Handles quoted fields, so a name may contain commas.
export function parseCsvLine(line: string): string[] {
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

function currencyName(code: string): string {
  if (CURRENCY_NAMES[code]) return CURRENCY_NAMES[code];
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) (seen.has(id) ? repeated : seen).add(id);
  return [...repeated];
}

export function loadReferenceData(
  platformCurrency = 'USD',
  dataDir = DEFAULT_DATA_DIR,
): ReferenceData {
  const countries = readCsv('countries.csv', dataDir).map((r) => ({
    _id: r.code,
    code: r.code,
    name: r.name,
    currency: r.currency,
  }));
  const cities = readCsv('cities.csv', dataDir).map((r) => ({
    _id: r.city_id,
    cityId: r.city_id,
    name: r.name,
    countryCode: r.country_code,
  }));
  const airports = readCsv('airports.csv', dataDir).map((r) => ({
    _id: r.iata_code,
    iataCode: r.iata_code,
    name: r.name,
    cityId: r.city_id,
    countryCode: r.country_code,
    timeZone: AIRPORT_TIME_ZONES[r.iata_code],
  }));
  const attractions = readCsv('attractions.csv', dataDir).map((r) => ({
    _id: r.attraction_id,
    attractionId: r.attraction_id,
    name: r.name,
    cityId: r.city_id,
  }));

  // The platform currency plus the currency of every country (GEN-12, ACC-09, ITN-18).
  const currencyCodes = [
    ...new Set([platformCurrency, ...countries.map((c) => c.currency)]),
  ];
  const currencies = currencyCodes.map((code) => ({
    _id: code,
    code,
    name: currencyName(code),
  }));

  // Reject inconsistent data before anything is written (NEW-05).
  const countryIds = new Set(countries.map((c) => c._id));
  const cityById = new Map(cities.map((c) => [c._id, c]));
  const problems = [
    ...[
      ['country', countries],
      ['city', cities],
      ['airport', airports],
      ['attraction', attractions],
    ].flatMap(([label, records]) =>
      duplicates((records as { _id: string }[]).map((r) => r._id)).map(
        (id) => `${label as string} ${id}: duplicate id`,
      ),
    ),
    ...[...countries, ...cities, ...airports, ...attractions]
      .filter((r) => !r._id)
      .map(() => 'a record has an empty id'),
    ...cities
      .filter((c) => !countryIds.has(c.countryCode))
      .map((c) => `city ${c._id}: unknown country ${c.countryCode}`),
    ...airports
      .filter((a) => !a.timeZone)
      .map((a) => `airport ${a._id}: no time zone in AIRPORT_TIME_ZONES`),
    ...airports
      .filter((a) => a.timeZone && !IANAZone.isValidZone(a.timeZone))
      .map((a) => `airport ${a._id}: invalid IANA time zone ${a.timeZone}`),
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

  return { countries, cities, airports, attractions, currencies };
}
