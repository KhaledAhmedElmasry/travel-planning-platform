import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateReviewDto } from './create-review.dto';
import { ListReviewsQueryDto } from './list-reviews-query.dto';
import { ReplyReviewDto } from './reply-review.dto';
import { UpdateReviewDto } from './update-review.dto';
import { globalValidationPipeOptions } from '../../common/pipes/validation.pipe';

describe('review DTOs', () => {
  describe('ReplyReviewDto', () => {
    it('trims a valid reply before validation', () => {
      const dto = plainToInstance(ReplyReviewDto, {
        text: '  Thank you for staying with us!  ',
      });

      expect(dto.text).toBe('Thank you for staying with us!');
      expect(validateSync(dto)).toHaveLength(0);
    });

    it.each([
      ['missing text', {}],
      ['empty text', { text: '' }],
      ['whitespace-only text', { text: ' \t\n ' }],
      ['a non-string value', { text: 42 }],
      ['null text', { text: null }],
    ])('rejects %s', (_description, value) => {
      const dto = plainToInstance(ReplyReviewDto, value);
      expect(validateSync(dto).some((error) => error.property === 'text')).toBe(
        true,
      );
    });

    it('accepts exactly 1000 characters and rejects more', () => {
      const valid = plainToInstance(ReplyReviewDto, { text: 'x'.repeat(1000) });
      const invalid = plainToInstance(ReplyReviewDto, {
        text: 'x'.repeat(1001),
      });

      expect(validateSync(valid)).toHaveLength(0);
      expect(
        validateSync(invalid).some((error) => error.property === 'text'),
      ).toBe(true);
    });
  });

  it.each([0, 6, 2.5, '5', null])('rejects invalid rating %p', (rating) => {
    const dto = plainToInstance(CreateReviewDto, { rating });
    expect(validateSync(dto).some((error) => error.property === 'rating')).toBe(
      true,
    );
  });

  it('accepts an integer rating from 1 to 5 and trims optional text', () => {
    const dto = plainToInstance(CreateReviewDto, {
      rating: 5,
      text: '  Lovely stay.  ',
    });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.text).toBe('Lovely stay.');
  });

  it('rejects review text longer than 1000 characters', () => {
    const dto = plainToInstance(CreateReviewDto, {
      rating: 4,
      text: 'x'.repeat(1001),
    });
    expect(validateSync(dto).some((error) => error.property === 'text')).toBe(
      true,
    );
  });

  it('rejects a missing rating', () => {
    const dto = plainToInstance(CreateReviewDto, {});
    expect(validateSync(dto).some((error) => error.property === 'rating')).toBe(
      true,
    );
  });

  it('allows a partial update but rejects invalid update values', () => {
    const valid = plainToInstance(UpdateReviewDto, { text: '  Updated  ' });
    expect(validateSync(valid)).toHaveLength(0);
    expect(valid.text).toBe('Updated');

    const invalid = plainToInstance(UpdateReviewDto, { rating: 1.5 });
    expect(
      validateSync(invalid).some((error) => error.property === 'rating'),
    ).toBe(true);
  });

  it.each(['0', '-1', '1.5', 'not-a-number'])(
    'rejects invalid page query %s through shared validation',
    async (page) => {
      const dto = plainToInstance(ListReviewsQueryDto, { page });
      const errors = validateSync(dto);
      expect(errors.some((error) => error.property === 'page')).toBe(true);
      const pipe = new ValidationPipe(globalValidationPipeOptions);
      await expect(
        pipe.transform(
          { page },
          { type: 'query', metatype: ListReviewsQueryDto, data: undefined },
        ),
      ).rejects.toMatchObject({
        response: {
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: [expect.objectContaining({ field: 'page' })],
        },
      });
    },
  );

  it('defaults an omitted page to 1 using the shared DTO', () => {
    const dto = plainToInstance(ListReviewsQueryDto, {});
    expect(dto.page).toBe(1);
    expect(validateSync(dto)).toHaveLength(0);
  });
});
