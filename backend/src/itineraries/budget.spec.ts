import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ItinerariesService } from './itineraries.service';
import { BudgetCategory } from './schemas/itinerary.schema';

function documentId(): Types.ObjectId {
  return new Types.ObjectId();
}

function day(
  number: number,
  budgets: Array<Record<string, unknown>>,
  activities: Array<Record<string, unknown>> = [],
) {
  const id = documentId();
  return {
    _id: id,
    number,
    date: new Date(`2026-12-0${number}T00:00:00.000Z`),
    cityId: 'cairo',
    budgets,
    activities,
    id(value: Types.ObjectId | string) {
      return String(value) === String(id) ? id : null;
    },
  };
}

describe('ItinerariesService (ITN-14)', () => {
  const userId = documentId().toHexString();
  const firstBudgetId = documentId();
  const firstDay = day(
    1,
    [
      {
        _id: firstBudgetId,
        category: BudgetCategory.Food,
        amount: 40,
        currency: 'USD',
        description: 'Dinner',
      },
    ],
    [{ cost: 10, currency: 'USD' }],
  );
  const secondDay = day(2, [
    {
      _id: documentId(),
      category: BudgetCategory.Accommodation,
      amount: 100,
      currency: 'EUR',
      description: '',
    },
  ]);
  const days = [firstDay, secondDay] as (typeof firstDay)[];
  days.id = (value: Types.ObjectId | string) =>
    days.find((candidate) => String(value) === String(candidate._id)) ?? null;
  const itinerary = {
    _id: documentId(),
    days,
    transportCosts: [
      {
        _id: documentId(),
        dayId: firstDay._id,
        amount: 25,
        currency: 'USD',
        mode: 'train',
      },
    ],
  } as never;

  function service(
    currencyFound = true,
    usersService?: { findById: jest.Mock },
    exchangeRatesService?: { convertTotals: jest.Mock },
  ): ItinerariesService {
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(itinerary),
      }),
    };
    const connection = {
      collection: jest.fn().mockReturnValue({
        findOne: jest
          .fn()
          .mockResolvedValue(currencyFound ? { _id: 'USD' } : null),
      }),
    };
    return new ItinerariesService(
      model as never,
      connection as never,
      undefined,
      usersService as never,
      exchangeRatesService as never,
    );
  }

  it('totals budget entries, activity costs and intercity transport per currency', async () => {
    await expect(
      service().getBudgetSummary(itinerary._id, userId),
    ).resolves.toEqual({
      totalsByCategory: {
        food: { USD: 40 },
        accommodation: { EUR: 100 },
        in_city_transport: {},
        activities: { USD: 10 },
      },
      totalsByDay: [
        {
          dayId: String(firstDay._id),
          dayNumber: 1,
          date: '2026-12-01',
          totals: { USD: 75 },
        },
        {
          dayId: String(secondDay._id),
          dayNumber: 2,
          date: '2026-12-02',
          totals: { EUR: 100 },
        },
      ],
      intercityTransport: { USD: 25 },
      grandTotal: { USD: 75, EUR: 100 },
      convertedTotal: null,
    });
  });

  it('rejects an unsupported currency before storing a budget entry', async () => {
    const current = service(false);
    await expect(
      current.addBudgetEntry(itinerary._id, firstDay._id, userId, {
        category: BudgetCategory.Food,
        amount: 1,
        currency: 'ZZZ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unsupported conversion currency', async () => {
    await expect(
      service(false).getBudgetSummary(itinerary._id, userId, 'ZZZ'),
    ).rejects.toThrow("Currency 'ZZZ' is not supported.");
  });

  it('converts category, day and grand totals to the preferred currency', async () => {
    const exchangeRates = {
      convertTotals: jest
        .fn()
        .mockImplementation((totals: Record<string, number>) => ({
          currency: 'EUR',
          rateDate: '2026-11-05',
          totals: {
            EUR: Number(
              Object.entries(totals)
                .reduce(
                  (sum, [code, amount]) =>
                    sum + Number(amount) * (code === 'USD' ? 0.8 : 1),
                  0,
                )
                .toFixed(2),
            ),
          },
        })),
    };
    const current = service(
      true,
      { findById: jest.fn().mockResolvedValue({ preferredCurrency: 'EUR' }) },
      exchangeRates,
    );

    const result = await current.getBudgetSummary(itinerary._id, userId);

    expect(result.convertedTotal).toMatchObject({
      currency: 'EUR',
      rateDate: '2026-11-05',
      totalsByCategory: {
        food: { EUR: 32 },
        accommodation: { EUR: 100 },
        activities: { EUR: 8 },
      },
      intercityTransport: { EUR: 20 },
      grandTotal: { EUR: 160 },
    });
    expect(exchangeRates.convertTotals).toHaveBeenCalled();
  });

  it('returns 404 for a budget entry owned by another user', async () => {
    const model = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
    const current = new ItinerariesService(model as never, {} as never);
    await expect(
      current.deleteBudgetEntry(firstBudgetId, userId),
    ).rejects.toThrow(NotFoundException);
  });
});
