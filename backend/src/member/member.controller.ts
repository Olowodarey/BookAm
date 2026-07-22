import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/roles';
import type { SafeUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AppealsService } from '../circles/appeals.service';
import {
  MAX_RECEIPT_BYTES,
  type ReceiptFile,
} from '../circles/receipt-storage.service';
import { parseAmountField } from '../circles/receipt-amount';
import { CreateAppealDto, VoteDto } from '../circles/dto/appeal.dto';
import { ApplyCollectorDto } from './dto/collector-application.dto';
import { MemberService } from './member.service';

/**
 * The contributor's window into their circles. No role restriction — anyone
 * signed in (a member, or a coordinator who also saves in someone else's
 * circle) sees exactly the circles their own memberships grant, nothing more.
 * Read-only except two personal actions: uploading their own receipt and
 * appeals (create/withdraw/vote). Verify/reject, membership and rotation
 * changes are rejected here by simply not existing — they live on the
 * coordinator-guarded /circles routes.
 */
@Controller('member')
@UseGuards(JwtAuthGuard)
export class MemberController {
  constructor(
    private readonly member: MemberService,
    private readonly appeals: AppealsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('circles')
  myCircles(@CurrentUser() user: SafeUser) {
    return this.member.myCircles(user.id);
  }

  // ---- Circle invites (coordinator invited me by email) --------------------

  @Get('invites')
  myInvites(@CurrentUser() user: SafeUser) {
    return this.member.myInvites(user.id);
  }

  @Post('invites/:membershipId/accept')
  acceptInvite(
    @CurrentUser() user: SafeUser,
    @Param('membershipId') membershipId: string,
  ) {
    return this.member.acceptInvite(user.id, membershipId);
  }

  @Delete('invites/:membershipId')
  declineInvite(
    @CurrentUser() user: SafeUser,
    @Param('membershipId') membershipId: string,
  ) {
    return this.member.declineInvite(user.id, membershipId);
  }

  @Get('circles/:circleId')
  circleDetail(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
  ) {
    return this.member.circleDetail(circleId, user.id);
  }

  @Post('circles/:circleId/receipt')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_RECEIPT_BYTES } }),
  )
  uploadMyReceipt(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
    @UploadedFile() file: ReceiptFile | undefined,
    @Body('amount') amount?: string,
  ) {
    return this.member.uploadMyReceipt(
      circleId,
      user.id,
      file,
      parseAmountField(amount),
    );
  }

  // ---- Become a collector --------------------------------------------------

  @Get('collector-application')
  myCollectorApplication(@CurrentUser() user: SafeUser) {
    return this.member.myCollectorApplication(user.id);
  }

  @Post('collector-application')
  applyCollector(
    @CurrentUser() user: SafeUser,
    @Body() dto: ApplyCollectorDto,
  ) {
    return this.member.applyCollector(user.id, dto.note);
  }

  // ---- Appeals -------------------------------------------------------------

  @Get('circles/:circleId/appeals')
  async listAppeals(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
  ) {
    const membership = await this.member.requireMembership(circleId, user.id);
    return this.appeals.list(circleId, membership.id);
  }

  @Post('circles/:circleId/appeals')
  async createAppeal(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
    @Body() dto: CreateAppealDto,
  ) {
    const membership = await this.member.requireMembership(circleId, user.id);
    return this.appeals.create(circleId, membership, dto.reason);
  }

  @Post('appeals/:appealId/withdraw')
  async withdrawAppeal(
    @CurrentUser() user: SafeUser,
    @Param('appealId') appealId: string,
  ) {
    const membership = await this.membershipForAppeal(appealId, user.id);
    return this.appeals.withdraw(appealId, membership);
  }

  @Put('appeals/:appealId/vote')
  async vote(
    @CurrentUser() user: SafeUser,
    @Param('appealId') appealId: string,
    @Body() dto: VoteDto,
  ) {
    const membership = await this.membershipForAppeal(appealId, user.id);
    return this.appeals.vote(appealId, membership, dto.value);
  }

  /** Resolves the caller's membership in the appeal's circle (404 otherwise). */
  private async membershipForAppeal(appealId: string, userId: string) {
    const appeal = await this.prisma.appeal.findUnique({
      where: { id: appealId },
      select: { circleId: true },
    });
    if (!appeal) throw new NotFoundException('Appeal not found');
    return this.member.requireMembership(appeal.circleId, userId);
  }
}
