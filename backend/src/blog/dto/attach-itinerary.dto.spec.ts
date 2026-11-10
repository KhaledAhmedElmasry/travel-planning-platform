import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttachItineraryDto } from './attach-itinerary.dto';

describe('AttachItineraryDto', () => {
  it('requires itineraryId when attaching or detaching', async () => {
    const dto = plainToInstance(AttachItineraryDto, {});
    const errors = await validate(dto);

    expect(errors.map(({ property }) => property)).toContain('itineraryId');
  });

  it('accepts null to detach and a valid ObjectId to attach', async () => {
    const detached = plainToInstance(AttachItineraryDto, {
      itineraryId: null,
    });
    const attached = plainToInstance(AttachItineraryDto, {
      itineraryId: '665f1c2a9b1e8a0012345678',
    });

    expect(await validate(detached)).toHaveLength(0);
    expect(await validate(attached)).toHaveLength(0);
  });

  it.each([
    ['malformed ObjectId', 'not-an-object-id'],
    ['empty string', ''],
    ['number', 42],
    ['boolean', true],
    ['object', {}],
    ['array', []],
  ])('rejects %s values', async (_label, value) => {
    const dto = plainToInstance(AttachItineraryDto, { itineraryId: value });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('strips extra properties using the global whitelist convention', async () => {
    const dto = plainToInstance(AttachItineraryDto, {
      itineraryId: null,
      authorId: '665f1c2a9b1e8a0012345678',
    });

    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto).not.toHaveProperty('authorId');
  });
});
