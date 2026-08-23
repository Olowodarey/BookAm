import { setDefaultResultOrder } from 'node:dns';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

// Railway's containers can't route IPv6 egress, but Node 18+ resolves DNS
// "verbatim" (IPv6 first). That makes outbound connections — notably Gmail
// SMTP (smtp.gmail.com:465) — hit an unreachable IPv6 address and time out
// (ENETUNREACH → ETIMEDOUT), which was silently breaking password-reset and
// verification emails in production. Prefer IPv4 so those connect.
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // iOS Safari ignores the client's `fetch(cache: 'no-store')` and will serve a
  // stale GET, so after a mutation the app looks like it "didn't refresh". The
  // server response header is authoritative and respected everywhere, so set
  // no-store on every API response. Immutable, random-named upload files are
  // exempt so receipts stay cacheable.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/uploads/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // Receipt files saved by ReceiptStorageService (local-dev storage; see the
  // S3/Cloudinary TODO there). URLs are random and unlisted, not auth-gated.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins });

  // Default 4000 so the Next.js frontend can keep 3000 locally.
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
