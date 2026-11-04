import { validate } from 'class-validator';
import { CreateCommentDto } from './create-comment.dto';

describe('CreateCommentDto', () => {
  async function errorsFor(text: unknown): Promise<string[]> {
    const dto = Object.assign(new CreateCommentDto(), { text });
    const errors = await validate(dto);
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  }

  it('accepts a non-whitespace comment up to 500 characters', async () => {
    expect(await errorsFor('Thanks for the travel tips!')).toEqual([]);
    expect(await errorsFor('a'.repeat(500))).toEqual([]);
  });

  it.each([undefined, '', '   \t\n'])(
    'rejects missing, empty or whitespace-only text (%s)',
    async (text) => {
      expect(await errorsFor(text)).not.toEqual([]);
    },
  );

  it('rejects more than 500 characters and non-string values', async () => {
    expect(await errorsFor('a'.repeat(501))).not.toEqual([]);
    expect(await errorsFor(42)).not.toEqual([]);
  });
});
