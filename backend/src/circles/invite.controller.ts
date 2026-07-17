import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MembersService } from './members.service';
import { JoinCircleDto } from './dto/member.dto';

/**
 * Public endpoints behind the shareable invite link — no auth; the random
 * token (rotatable/revocable by the coordinator) is the credential.
 */
@Controller('invite')
export class InviteController {
  constructor(private readonly members: MembersService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.members.preview(token);
  }

  @Post(':token/join')
  join(@Param('token') token: string, @Body() dto: JoinCircleDto) {
    return this.members.join(token, dto);
  }
}
