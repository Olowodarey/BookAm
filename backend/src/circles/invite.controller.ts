import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/roles';
import type { SafeUser } from '../auth/auth.types';
import { MembersService } from './members.service';

/**
 * The shareable invite link. Previewing is public (the token is the
 * credential), but *joining* now requires a signed-in account and only
 * creates a REQUEST — the coordinator approves it, so nobody joins just by
 * having the link.
 */
@Controller('invite')
export class InviteController {
  constructor(private readonly members: MembersService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.members.preview(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':token/join')
  requestJoin(@CurrentUser() user: SafeUser, @Param('token') token: string) {
    return this.members.requestJoin(token, user.id);
  }
}
