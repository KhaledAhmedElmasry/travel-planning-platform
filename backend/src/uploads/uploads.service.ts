import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { copyFile, mkdir, unlink, writeFile } from 'fs/promises';
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
  // GEN-08: JPG or PNG (checked by the file bytes too), at most 5 MB, served at /uploads/images/.
  // The per-item limit (5 images) is checked by the module that owns the images.
  async storeImage(file: Express.Multer.File): Promise<StoredImage> {
    if (
      !['image/jpeg', 'image/png'].includes(file.mimetype) ||
      file.size > 5 * 1024 * 1024
    ) {
      throw new BadRequestException(
        'The image must be a JPG or PNG file of at most 5 MB.',
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

  // ITN-21: a clone is independent of the original, so it gets its own copy of every image file.
  async copyImage(storageKey: string): Promise<StoredImage> {
    const match = /^[\w-]+\.(png|jpg)$/.exec(storageKey);
    if (!match) throw new Error(`Invalid image storage key: ${storageKey}`);
    const directory = join(process.cwd(), 'uploads', 'images');
    const newKey = `${randomUUID()}.${match[1]}`;
    await copyFile(join(directory, storageKey), join(directory, newKey));
    return {
      id: new Types.ObjectId().toHexString(),
      url: `/uploads/images/${newKey}`,
      storageKey: newKey,
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
