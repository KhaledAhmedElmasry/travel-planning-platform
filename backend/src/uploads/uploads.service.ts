import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { Types } from 'mongoose';

// Area: Community & Cross-cutting
// Business logic and database access for: GEN-08
export interface StoredImage {
  id: string;
  url: string;
  storageKey: string;
}

@Injectable()
export class UploadsService {
  // PLACEHOLDER(GEN-08): replace this shared adapter with Area 4's merged media service.
  async storeImage(file: Express.Multer.File): Promise<StoredImage> {
    if (
      !['image/jpeg', 'image/png'].includes(file.mimetype) ||
      file.size > 5 * 1024 * 1024
    ) {
      throw new BadRequestException(
        'Not JPG/PNG, larger than 5 MB, or the activity already has 5 images.',
      );
    }

    const bytes = file.buffer;
    const isPng =
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    if (file.mimetype === 'image/png' ? !isPng : !isJpg) {
      throw new BadRequestException(
        'The file content is not a real JPG/PNG image.',
      );
    }

    const extension = file.mimetype === 'image/png' ? 'png' : 'jpg';
    const storageKey = `${randomUUID()}.${extension}`;
    const directory = join(process.cwd(), 'uploads', 'images');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, storageKey), file.buffer);

    return {
      id: new Types.ObjectId().toHexString(),
      url: `/uploads/images/${storageKey}`,
      storageKey,
    };
  }

  async removeImage(storageKey: string): Promise<void> {
    try {
      await unlink(join(process.cwd(), 'uploads', 'images', storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async removeImages(storageKeys: string[]): Promise<void> {
    await Promise.all(
      storageKeys.map((storageKey) => this.removeImage(storageKey)),
    );
  }
}
