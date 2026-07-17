import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Minimal shape of a multer in-memory upload. Declared locally so we don't
 * need @types/multer — @nestjs/platform-express bundles multer at runtime.
 */
export interface ReceiptFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

/**
 * Storage adapter for receipt files (proof-of-payment images/PDFs).
 * Receipts are records only — BookAm never holds or moves the money itself.
 *
 * // TODO: S3/Cloudinary — swap save() to upload remotely and return the
 * // remote URL; callers only ever see the returned URL string.
 * Local dev: files land in backend/uploads/ and are served at /uploads/*
 * (see main.ts). Filenames are random, but the route is unauthenticated —
 * move to signed URLs alongside the remote-storage TODO.
 */
@Injectable()
export class ReceiptStorageService {
  private readonly dir = join(process.cwd(), 'uploads');

  async save(file: ReceiptFile | undefined, prefix: string): Promise<string> {
    if (!file) {
      throw new BadRequestException('Attach a receipt file (field "file")');
    }
    const ext = ALLOWED_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Receipts must be a JPG, PNG, WebP image or a PDF',
      );
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      throw new BadRequestException('Receipt file is too large (max 5 MB)');
    }

    const name = `${prefix}-${randomBytes(10).toString('hex')}${ext}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, name), file.buffer);
    return `/uploads/${name}`;
  }
}
