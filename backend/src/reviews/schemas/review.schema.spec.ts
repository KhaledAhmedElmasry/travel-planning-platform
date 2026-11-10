import { ReviewSchema } from './review.schema';

describe('Review schema', () => {
  it('enforces one review per reservation with a unique index', () => {
    expect(ReviewSchema.indexes()).toContainEqual([
      { reservation: 1 },
      { unique: true, background: true },
    ]);
  });

  it('defaults moderation visibility to visible', () => {
    expect(ReviewSchema.path('hidden').options.default).toBe(false);
  });
});
