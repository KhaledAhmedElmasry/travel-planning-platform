import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import type { NewHotelPhoto } from './hotels.service';

// TEMPORARY (GEN-08): replace with the shared uploads module once Area 4 merges it.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

// The file as multer's memory storage provides it.
export interface HotelPhotoFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Photos are stored in backend/uploads/hotels (the server runs from backend/).
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'hotels');

// Decide the type from the file's first bytes, not from the name the client sent.
function detectExtension(buffer: Buffer): 'jpg' | 'png' | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature)) {
    return 'png';
  }
  return null;
}

// Checks every file first, so a bad request writes nothing to disk.
export async function storeHotelPhotos(
  files: HotelPhotoFile[] = [],
): Promise<NewHotelPhoto[]> {
  const checked = files.map((file) => {
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException(
        `Photo "${file.originalname}" is larger than 5 MB.`,
      );
    }
    const ext = detectExtension(file.buffer);
    if (!ext) {
      throw new BadRequestException(
        `Photo "${file.originalname}" must be a JPG or PNG image.`,
      );
    }
    return { file, ext };
  });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const stored: NewHotelPhoto[] = [];
  for (const { file, ext } of checked) {
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    stored.push({ url: `/uploads/hotels/${filename}`, filename });
  }
  return stored;
}

// Used to clean up when the service rejects the request after the files were written.
export async function deleteHotelPhotos(photos: NewHotelPhoto[]) {
  await Promise.all(
    photos.map((p) =>
      unlink(join(UPLOAD_DIR, p.filename)).catch(() => undefined),
    ),
  );
}
