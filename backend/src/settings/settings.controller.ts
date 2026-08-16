import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService, type SupportContact } from './settings.service';

/**
 * Read-only support contact for any signed-in user (coordinator or member).
 * The admin write endpoints live on AdminController (ADMIN-guarded).
 */
@Controller('support-contact')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SupportContact> {
    return this.settings.supportContact();
  }
}
