import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookingStatus, ProviderType } from '../../common/enums';
import {
  AnalyticsDateFilterBy,
  AnalyticsQueryDto,
} from './analytics-query.dto';

describe('AnalyticsQueryDto', () => {
  it('accepts an empty query object and uses default page = 1', async () => {
    const dto = plainToInstance(AnalyticsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
  });

  it('accepts valid date range, provider type, status, and providerId', async () => {
    const dto = plainToInstance(AnalyticsQueryDto, {
      from: '2026-01-01',
      to: '2026-12-31',
      type: ProviderType.Airline,
      status: BookingStatus.Confirmed,
      providerId: '665f1c2a9b1e8a0012340001',
      dateBy: AnalyticsDateFilterBy.Travel,
      page: 2,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.from).toBe('2026-01-01');
    expect(dto.to).toBe('2026-12-31');
    expect(dto.type).toBe(ProviderType.Airline);
    expect(dto.status).toBe(BookingStatus.Confirmed);
    expect(dto.providerId).toBe('665f1c2a9b1e8a0012340001');
    expect(dto.dateBy).toBe(AnalyticsDateFilterBy.Travel);
    expect(dto.page).toBe(2);
  });

  it('accepts hotel provider type and created dateBy', async () => {
    const dto = plainToInstance(AnalyticsQueryDto, {
      type: ProviderType.Hotel,
      dateBy: AnalyticsDateFilterBy.Created,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.type).toBe(ProviderType.Hotel);
    expect(dto.dateBy).toBe(AnalyticsDateFilterBy.Created);
  });

  it.each([
    ['invalid from date string', { from: '2026/01/01' }, 'from'],
    ['non-date string for from', { from: 'invalid-date' }, 'from'],
    ['invalid to date string', { to: '2026-02-30' }, 'to'],
    ['invalid provider type', { type: 'train' }, 'type'],
    ['invalid status', { status: 'in_progress' }, 'status'],
    ['invalid providerId', { providerId: 'not-an-object-id' }, 'providerId'],
    ['invalid dateBy', { dateBy: 'weekly' }, 'dateBy'],
    ['negative page number', { page: -1 }, 'page'],
    ['zero page number', { page: 0 }, 'page'],
  ])('rejects %s', async (_label, payload, expectedField) => {
    const dto = plainToInstance(AnalyticsQueryDto, payload);
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain(expectedField);
  });

  it('strips extra properties under whitelist convention', async () => {
    const dto = plainToInstance(AnalyticsQueryDto, {
      from: '2026-01-01',
      unexpectedProp: 'extra',
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('unexpectedProp');
  });
});
