import { Injectable } from '@nestjs/common';
import { PlatformSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './dto/settings.dto';

/** Public support contact — the two fields any signed-in user may read. */
export interface SupportContact {
  supportWhatsapp: string | null;
  supportEmail: string | null;
}

const SETTINGS_ID = 1;

/**
 * Reads/writes the single-row PlatformSettings (id = 1). The row may not exist
 * yet on a fresh install, so reads default to empty values and writes upsert.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full settings row for the admin console (creates it if missing). */
  async get(): Promise<PlatformSettings> {
    return this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  /** Just the support contact, for coordinators and members. */
  async supportContact(): Promise<SupportContact> {
    const row = await this.prisma.platformSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    return {
      supportWhatsapp: row?.supportWhatsapp ?? null,
      supportEmail: row?.supportEmail ?? null,
    };
  }

  /** Admin update. Blank strings clear the field (stored as null). */
  async update(dto: UpdateSettingsDto): Promise<PlatformSettings> {
    const data = {
      ...(dto.supportWhatsapp !== undefined
        ? { supportWhatsapp: normalize(dto.supportWhatsapp) }
        : {}),
      ...(dto.supportEmail !== undefined
        ? { supportEmail: normalize(dto.supportEmail) }
        : {}),
    };
    return this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });
  }
}

/** Trim and turn an empty string into null so cleared fields don't linger. */
function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
