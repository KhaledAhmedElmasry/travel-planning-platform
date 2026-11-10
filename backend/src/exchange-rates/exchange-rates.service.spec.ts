import { ExchangeRatesService } from './exchange-rates.service';

// ITN-18: itinerary budgets are converted with the rates cached for today. The model is a test
// double that returns today's cached rates, so the expected values follow from plain arithmetic.
describe('ExchangeRatesService.convertTotals (ITN-18)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rates = new Map<string, number>([
    ['USD', 1],
    ['EGP', 3],
    ['AED', 3],
    ['SAR', 3],
    ['EUR', 0.5],
  ]);
  const cached = { rateDate: today, fetchedDate: today, rates };
  const model = {
    findOne: jest.fn(() => ({ exec: () => Promise.resolve(cached) })),
  };
  const service = new ExchangeRatesService(
    model as never,
    { get: () => undefined } as never,
  );

  it('converts every amount and rounds the total once, to cents', async () => {
    // 1 EGP + 1 AED + 1 SAR = 1/3 + 1/3 + 1/3 USD = exactly 1.00 USD.
    const result = await service.convertTotals(
      { EGP: 1, AED: 1, SAR: 1 },
      'USD',
    );
    expect(result.totals).toEqual({ USD: 1 });
    expect(result.rateDate).toBe(today);
    expect(result.stale).toBe(false);
  });

  it('converts through the base currency', async () => {
    // 10 EGP = 3.333... USD = 1.666... EUR -> 1.67 EUR.
    const result = await service.convertTotals({ EGP: 10 }, 'EUR');
    expect(result.totals).toEqual({ EUR: 1.67 });
  });

  it('answers 503 for a currency without a rate', async () => {
    await expect(service.convertTotals({ XYZ: 1 }, 'USD')).rejects.toThrow(
      /XYZ/,
    );
  });
});
