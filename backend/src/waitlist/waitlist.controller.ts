import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/waitlist.dto';

@Controller()
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  /** Public: anyone on the landing page can drop their email. */
  @Post('waitlist')
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlist.join(dto.email, dto.source);
  }

  /** Admin only: read the collected signups. */
  @Get('admin/waitlist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  list() {
    return this.waitlist.list();
  }
}
