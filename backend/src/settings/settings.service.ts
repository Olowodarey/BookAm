import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from '../entities';
import type { UpdateSettingsDto } from './dto/settings.dto';

/** Public support contact — the two fields any signed-in user may read. */
export interface SupportContact {
  supportWhatsapp: string | null;
  supportEmail: string | null;
}

const SETTINGS_ID = 1;

/**
 * Reads/writes the single-row PlatformSettings (id = 1). The row may not exist
 * yet on a fresh install, so reads default to empty values and writes create it.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settings: Repository<PlatformSettings>,
  ) {}

  /** Full settings row for the admin console (creates it if missing). */
  async get(): Promise<PlatformSettings> {
    const existing = await this.settings.findOne({
      where: { id: SETTINGS_ID },
    });
    if (existing) return existing;
    return this.settings.save(this.settings.create({ id: SETTINGS_ID }));
  }

  /** Just the support contact, for coordinators and members. */
  async supportContact(): Promise<SupportContact> {
    const row = await this.settings.findOne({ where: { id: SETTINGS_ID } });
    return {
      supportWhatsapp: row?.supportWhatsapp ?? null,
      supportEmail: row?.supportEmail ?? null,
    };
  }

  /** Admin update. Blank strings clear the field (stored as null). */
  async update(dto: UpdateSettingsDto): Promise<PlatformSettings> {
    const row = await this.get();
    if (dto.supportWhatsapp !== undefined) {
      row.supportWhatsapp = normalize(dto.supportWhatsapp);
    }
    if (dto.supportEmail !== undefined) {
      row.supportEmail = normalize(dto.supportEmail);
    }
    return this.settings.save(row);
  }
}

/** Trim and turn an empty string into null so cleared fields don't linger. */
function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
