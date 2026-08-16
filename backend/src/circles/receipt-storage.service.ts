import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

interface R2Config {
  client: S3Client;
  bucket: string;
  publicBase: string;
}

/**
 * Storage adapter for receipt files (proof-of-payment images/PDFs).
 * Receipts are records only — BookAm never holds or moves the money itself.
 *
 * Cloudflare R2 (S3-compatible, zero egress) when the R2_* env vars are set;
 * otherwise falls back to local disk (backend/uploads/, served at /uploads/*
 * — see main.ts) so dev works without cloud credentials. Callers only ever
 * see the returned URL string, so the two paths are interchangeable.
 *
 * Filenames are random, but neither the R2 public URL nor the /uploads route
 * is auth-gated — move to signed URLs if receipts must be truly private.
 */
@Injectable()
export class ReceiptStorageService {
  private readonly logger = new Logger(ReceiptStorageService.name);
  private readonly dir = join(process.cwd(), 'uploads');
  private readonly r2 = this.initR2();

  private initR2(): R2Config | null {
    const {
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET,
      R2_PUBLIC_BASE_URL,
    } = process.env;

    if (
      !R2_ACCOUNT_ID ||
      !R2_ACCESS_KEY_ID ||
      !R2_SECRET_ACCESS_KEY ||
      !R2_BUCKET ||
      !R2_PUBLIC_BASE_URL
    ) {
      this.logger.warn(
        'R2 not configured — receipts fall back to local disk (/uploads).',
      );
      return null;
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    this.logger.log(`Receipts stored in Cloudflare R2 bucket "${R2_BUCKET}".`);
    return {
      client,
      bucket: R2_BUCKET,
      publicBase: R2_PUBLIC_BASE_URL.replace(/\/+$/, ''),
    };
  }

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
      throw new BadRequestException('Receipt file is too large (max 2 MB)');
    }

    const name = `${prefix}-${randomBytes(10).toString('hex')}${ext}`;

    if (this.r2) {
      await this.r2.client.send(
        new PutObjectCommand({
          Bucket: this.r2.bucket,
          Key: name,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return `${this.r2.publicBase}/${name}`;
    }

    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, name), file.buffer);
    return `/uploads/${name}`;
  }
}
