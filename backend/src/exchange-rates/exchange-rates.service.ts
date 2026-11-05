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
  private dailySnapshot?: RateSnapshot & { fetchedDate: string };

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
      totals: converted,
    };
  }

  private async getRates(): Promise<RateSnapshot> {
    const today = new Date().toISOString().slice(0, 10);
    if (this.dailySnapshot?.fetchedDate === today) {
      return this.dailySnapshot;
    }
    const cachedToday = await this.exchangeRateModel
      .findOne({ baseCurrency: this.baseCurrency, fetchedDate: today })
      .exec();
    if (cachedToday) {
      const snapshot = toSnapshot(cachedToday);
      this.dailySnapshot = { ...snapshot, fetchedDate: today };
      return snapshot;
    }

    try {
      const response = await fetch(
        `${this.apiUrl}?base=${this.baseCurrency}&api_key=${encodeURIComponent(
          this.config.getOrThrow<string>('FXRATES_API_KEY'),
        )}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok)
        throw new Error(`FXRatesAPI returned ${response.status}`);
      const body = (await response.json()) as {
        date?: string;
        rates?: Record<string, unknown>;
      };
      const rates = parseRates(body.rates);
      const rateDate = isDate(body.date) ? body.date : today;
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
      this.dailySnapshot = { rateDate, rates, fetchedDate: today };
      return { rateDate, rates };
    } catch {
      const lastCached = await this.exchangeRateModel
        .findOne({ baseCurrency: this.baseCurrency })
        .sort({ rateDate: -1 })
        .exec();
      if (lastCached) {
        const snapshot = toSnapshot(lastCached);
        this.dailySnapshot = { ...snapshot, fetchedDate: today };
        return snapshot;
      }
      throw new ServiceUnavailableException(
        'Exchange rates are unavailable and no cached rates exist.',
      );
    }
  }
}

export interface ConvertedTotals {
  currency: string;
  rateDate: string;
  totals: Record<string, number>;
}

interface RateSnapshot {
  rateDate: string;
  rates: Record<string, number>;
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

function toSnapshot(document: ExchangeRateDocument): RateSnapshot {
  return {
    rateDate: document.rateDate,
    rates: Object.fromEntries(document.rates.entries()),
  };
}

function isDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
