import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

// GEN-08: the image check is shared by blog posts (BLG-10) and itinerary activities (ITN-11), so
// its message names only the file rule, never one of the two (a post upload must not mention an
// "activity").

describe('UploadsService.storeImage (GEN-08)', () => {
  const service = new UploadsService();
  const file = (mimetype: string, size: number) =>
    ({ mimetype, size, buffer: Buffer.alloc(16) }) as Express.Multer.File;

  it.each([
    ['a GIF', file('image/gif', 1000)],
    ['a PNG over 5 MB', file('image/png', 5 * 1024 * 1024 + 1)],
  ])(
    'rejects %s with a message that fits posts and activities',
    async (_, f) => {
      const error = await service.storeImage(f).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const message = (error as BadRequestException).message;
      expect(message).toMatch(/JPG or PNG/);
      expect(message).toMatch(/5 MB/);
      expect(message).not.toMatch(/activity|post/i);
    },
  );
});
