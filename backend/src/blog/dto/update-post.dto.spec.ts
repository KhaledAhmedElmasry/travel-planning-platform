import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PostStatus } from '../schemas/post.schema';
import { UpdatePostDto } from './update-post.dto';

async function errorsFor(input: object) {
  return validate(plainToInstance(UpdatePostDto, input));
}

describe('UpdatePostDto', () => {
  it('trims strings and normalizes tags to lowercase', async () => {
    const dto = plainToInstance(UpdatePostDto, {
      title: ' A title ',
      body: ' Text ',
      tags: [' Egypt ', 'CAIRO'],
      status: PostStatus.Published,
    });

    expect(dto).toMatchObject({
      title: 'A title',
      body: 'Text',
      tags: ['egypt', 'cairo'],
      status: PostStatus.Published,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('supports clearing tags with an empty array', async () => {
    await expect(errorsFor({ tags: [] })).resolves.toHaveLength(0);
  });

  it('accepts the documented maximum of five tags, each exactly 30 characters', async () => {
    await expect(
      errorsFor({
        tags: Array.from(
          { length: 5 },
          (_, index) => `${index}${'x'.repeat(29)}`,
        ),
      }),
    ).resolves.toHaveLength(0);
  });

  it('rejects more than five tags, empty tags, overlong tags, and duplicates after normalization', async () => {
    for (const tags of [
      ['1', '2', '3', '4', '5', '6'],
      [''],
      ['x'.repeat(31)],
      ['Egypt', ' egypt '],
    ]) {
      expect(await errorsFor({ tags })).toHaveLength(1);
    }
  });

  it('rejects invalid tag and post field types and unsupported status values', async () => {
    for (const input of [
      { tags: 'egypt' },
      { tags: [3] },
      { title: 10 },
      { body: false },
      { status: 'scheduled' },
    ]) {
      expect(await errorsFor(input)).not.toHaveLength(0);
    }
  });

  it('rejects empty and whitespace-only title/body values and title over 200 characters', async () => {
    for (const input of [
      { title: '' },
      { title: '   ' },
      { body: '' },
      { body: '   ' },
      { title: 'x'.repeat(201) },
    ]) {
      expect(await errorsFor(input)).not.toHaveLength(0);
    }
  });
});
