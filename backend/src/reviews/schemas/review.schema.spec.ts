import { Review, ReviewSchema } from './review.schema';

interface ReplyPathDefinition {
  defaultValue?: unknown;
  options: { required?: boolean };
  schema: {
    path(name: string): {
      instance: string;
      isRequired?: boolean;
      options: {
        maxlength?: number;
        ref?: string;
        required?: boolean;
        trim?: boolean;
      };
    };
  };
}

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

  it('keeps the reply absent and optional until it is created', () => {
    const replyPath = ReviewSchema.path(
      'reply',
    ) as unknown as ReplyPathDefinition;

    expect(new Review().reply).toBeUndefined();
    expect(replyPath.options.required).toBe(false);
    expect(replyPath.defaultValue).toBeUndefined();
  });

  it('defines validated reply text, a private moderator reference, and a required date', () => {
    const replyPath = ReviewSchema.path(
      'reply',
    ) as unknown as ReplyPathDefinition;
    const text = replyPath.schema.path('text');
    const moderator = replyPath.schema.path('moderator');
    const createdAt = replyPath.schema.path('createdAt');

    expect(text).toMatchObject({
      instance: 'String',
      isRequired: true,
      options: { trim: true, maxlength: 1000 },
    });
    expect(moderator).toMatchObject({
      instance: 'ObjectId',
      isRequired: true,
      options: { ref: 'User', required: true },
    });
    expect(createdAt).toMatchObject({ instance: 'Date', isRequired: true });
  });
});
