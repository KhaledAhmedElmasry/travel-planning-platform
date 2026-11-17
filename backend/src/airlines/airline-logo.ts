import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

// Area: Airlines & Flight Inventory
// The airline logo (FLT-01) following the shared upload rule (GEN-08): JPG or PNG, at most 5 MB,
// one logo per airline. The file arrives with multipart/form-data in the "logo" field.
//
// Files are saved in backend/uploads/airlines/ (git-ignored) and the airline stores the public
// path /uploads/airlines/<file>, served by the static /uploads route in main.ts (GEN-08).

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

// Multer limits for the "logo" field: one file. The size limit is higher than 5 MB on purpose, so
// a 6 MB logo gets our clear 400 message below instead of multer's 413.
export const LOGO_UPLOAD_LIMITS = { files: 1, fileSize: 20 * 1024 * 1024 };

const LOGO_DIR = join(process.cwd(), 'uploads', 'airlines');
const LOGO_URL_PREFIX = '/uploads/airlines/';

// The part of Express.Multer.File this file uses (memory storage).
export interface UploadedLogo {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// JPG starts with FF D8 FF, PNG with 89 50 4E 47 0D 0A 1A 0A. Checking the bytes means a renamed
// file (e.g. a PDF called logo.png) is rejected even if the browser says it is an image.
function detectImageType(buffer: Buffer): 'jpg' | 'png' | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= png.length && png.every((b, i) => buffer[i] === b)) {
    return 'png';
  }
  return null;
}

// GEN-08: throws 400 unless the file is a JPG or PNG of at most 5 MB. Returns the extension.
export function validateLogo(file: UploadedLogo): 'jpg' | 'png' {
  if (!file.buffer || file.size === 0) {
    throw new BadRequestException('The logo file is empty.');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new BadRequestException('The logo must be at most 5 MB.');
  }
  const type = detectImageType(file.buffer);
  if (!type) {
    throw new BadRequestException('The logo must be a JPG or PNG image.');
  }
  return type;
}

// Saves a validated logo and returns its public path.
export async function saveLogo(
  file: UploadedLogo,
  extension: 'jpg' | 'png',
): Promise<string> {
  await fs.mkdir(LOGO_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${extension}`;
  await fs.writeFile(join(LOGO_DIR, fileName), file.buffer);
  return `${LOGO_URL_PREFIX}${fileName}`;
}

// Deletes a logo saved by saveLogo (when it is replaced). Never fails the request.
export async function deleteLogo(logoUrl: string | null): Promise<void> {
  if (!logoUrl || !logoUrl.startsWith(LOGO_URL_PREFIX)) return;
  const fileName = logoUrl.slice(LOGO_URL_PREFIX.length);
  if (fileName.includes('/') || fileName.includes('\\')) return;
  await fs.unlink(join(LOGO_DIR, fileName)).catch(() => undefined);
}
