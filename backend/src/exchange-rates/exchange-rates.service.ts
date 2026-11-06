import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ExchangeRate,
  ExchangeRateDocument,
} from './schemas/exchange-rate.schema';

@Injectable()
export class ExchangeRatesService {
  private readonly baseCurrency = 'USD';
  private readonly apiUrl = 'https://api.fxratesapi.com/latest';
  // Today's rates kept in memory. A stale snapshot (old cached rates used because the API failed)
  // is kept only until retryAt, then the API is tried again.
  private dailySnapshot?: RateSnapshot & {
    fetchedDate: string;
    retryAt?: number;
  };

  constructor(
    @InjectModel(ExchangeRate.name)
    private readonly exchangeRateModel: Model<ExchangeRate>,
    private readonly config: ConfigService,
  ) {}

  async convertTotals(
    totals: Record<string, number>,
    targetCurrency: string,
  ): Promise<ConvertedTotals> {
    const snapshot = await this.getRates();
    const targetRate = snapshot.rates[targetCurrency];
    if (targetRate === undefined) {
      throw new ServiceUnavailableException(
        `Exchange rate for ${targetCurrency} is unavailable.`,
      );
    }

    const converted: Record<string, number> = {};
    for (const [sourceCurrency, amount] of Object.entries(totals)) {
      const sourceRate = snapshot.rates[sourceCurrency];
      if (sourceRate === undefined) {
        throw new ServiceUnavailableException(
          `Exchange rate for ${sourceCurrency} is unavailable.`,
        );
      }
      converted[targetCurrency] = roundCurrency(
        (converted[targetCurrency] ?? 0) + (amount * targetRate) / sourceRate,
      );
    }
    return {
      currency: targetCurrency,
      rateDate: snapshot.rateDate,
      stale: snapshot.stale,
      totals: converted,
    };
  }

  private async getRates(): Promise<RateSnapshot> {
    const today = new Date().toISOString().slice(0, 10);
    if (
      this.dailySnapshot?.fetchedDate === today &&
      (!this.dailySnapshot.stale ||
        Date.now() < (this.dailySnapshot.retryAt ?? 0))
    ) {
      return this.dailySnapshot;
    }
    const cachedToday = await this.exchangeRateModel
      .findOne({ baseCurrency: this.baseCurrency, fetchedDate: today })
      .exec();
    if (cachedToday) {
      const snapshot = toSnapshot(cachedToday, false);
      this.dailySnapshot = { ...snapshot, fetchedDate: today };
      return snapshot;
    }

    try {
      // FXRATES_API_KEY is optional: the free FXRatesAPI endpoint also answers without a key.
      const apiKey = this.config.get<string>('FXRATES_API_KEY');
      const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
      const response = await fetch(
        `${this.apiUrl}?base=${this.baseCurrency}${keyParam}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok)
        throw new Error(`FXRatesAPI returned ${response.status}`);
      const body = (await response.json()) as {
        date?: string;
        rates?: Record<string, unknown>;
      };
      const rates = parseRates(body.rates);
      // FXRatesAPI sends a timestamp such as 2026-11-06T13:37:00.000Z; keep its date part.
      const rateDate = dateOf(body.date) ?? today;
      const cached = await this.exchangeRateModel
        .findOneAndUpdate(
          { baseCurrency: this.baseCurrency, fetchedDate: today },
          {
            $set: {
              baseCurrency: this.baseCurrency,
              fetchedDate: today,
              rateDate,
              rates,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .exec();
      if (!cached)
        throw new Error('The exchange-rate cache could not be saved.');
      this.dailySnapshot = {
        rateDate,
        rates,
        stale: false,
        fetchedDate: today,
      };
      return { rateDate, rates, stale: false };
    } catch {
      const lastCached = await this.exchangeRateModel
        .findOne({ baseCurrency: this.baseCurrency })
        .sort({ rateDate: -1 })
        .exec();
      if (lastCached) {
        // ITN-18: the API is unavailable, so the last cached rates are used. They are stale unless
        // they were already fetched today.
        const snapshot = toSnapshot(
          lastCached,
          lastCached.fetchedDate !== today,
        );
        this.dailySnapshot = {
          ...snapshot,
          fetchedDate: today,
          retryAt: Date.now() + STALE_RETRY_MS,
        };
        return snapshot;
      }
      throw new ServiceUnavailableException(
        'Exchange rates are unavailable and no cached rates exist.',
      );
    }
  }
}

// After a failed API call, how long the old cached rates are reused before trying the API again.
const STALE_RETRY_MS = 15 * 60 * 1000;

export interface ConvertedTotals {
  currency: string;
  rateDate: string;
  // true when FXRatesAPI was unavailable and older cached rates were used (ITN-18).
  stale: boolean;
  totals: Record<string, number>;
}

interface RateSnapshot {
  rateDate: string;
  rates: Record<string, number>;
  stale: boolean;
}

function parseRates(
  value: Record<string, unknown> | undefined,
): Record<string, number> {
  if (!value) throw new Error('FXRatesAPI returned no rates.');
  const rates: Record<string, number> = { USD: 1 };
  for (const [currency, rate] of Object.entries(value)) {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('FXRatesAPI returned invalid rates.');
    }
    rates[currency.toUpperCase()] = rate;
  }
  return rates;
}

function toSnapshot(
  document: ExchangeRateDocument,
  stale: boolean,
): RateSnapshot {
  return {
    rateDate: document.rateDate,
    rates: Object.fromEntries(document.rates.entries()),
    stale,
  };
}

// The YYYY-MM-DD part of "2026-11-06" or "2026-11-06T13:37:00.000Z", else undefined.
function dateOf(value: string | undefined): string | undefined {
  const match = value === undefined ? null : /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : undefined;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
