import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwapRequest } from '../entities';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/roles';
import type { SafeUser } from '../auth/auth.types';
import { SwapsService } from '../circles/swaps.service';
import {
  MAX_RECEIPT_BYTES,
  type ReceiptFile,
} from '../circles/receipt-storage.service';
import { parseAmountField } from '../circles/receipt-amount';
import { CreateSwapDto } from '../circles/dto/swap.dto';
import { ApplyCollectorDto } from './dto/collector-application.dto';
import { MemberService } from './member.service';

/**
 * The contributor's window into their circles. No role restriction — anyone
 * signed in (a member, or a coordinator who also saves in someone else's
 * circle) sees exactly the circles their own memberships grant, nothing more.
 * Read-only except a few personal actions: uploading their own receipt and
 * position swaps (request/accept/decline/cancel). Verify/reject, membership and
 * rotation changes are rejected here by simply not existing — they live on the
 * coordinator-guarded /circles routes.
 */
@Controller('member')
@UseGuards(JwtAuthGuard)
export class MemberController {
  constructor(
    private readonly member: MemberService,
    private readonly swaps: SwapsService,
    @InjectRepository(SwapRequest)
    private readonly swapRepo: Repository<SwapRequest>,
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

  @Get('circles/:circleId/rounds')
  circleRounds(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
  ) {
    return this.member.circleRounds(circleId, user.id);
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

  // ---- Position swaps ------------------------------------------------------

  @Get('circles/:circleId/swaps')
  async listSwaps(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
  ) {
    const membership = await this.member.requireMembership(circleId, user.id);
    return this.swaps.list(circleId, membership.id);
  }

  @Post('circles/:circleId/swaps')
  async createSwap(
    @CurrentUser() user: SafeUser,
    @Param('circleId') circleId: string,
    @Body() dto: CreateSwapDto,
  ) {
    const membership = await this.member.requireMembership(circleId, user.id);
    return this.swaps.create(
      circleId,
      membership,
      dto.targetMembershipId,
      dto.note,
    );
  }

  @Post('swaps/:swapId/accept')
  async acceptSwap(
    @CurrentUser() user: SafeUser,
    @Param('swapId') swapId: string,
  ) {
    const membership = await this.membershipForSwap(swapId, user.id);
    return this.swaps.respond(swapId, membership, true);
  }

  @Post('swaps/:swapId/decline')
  async declineSwap(
    @CurrentUser() user: SafeUser,
    @Param('swapId') swapId: string,
  ) {
    const membership = await this.membershipForSwap(swapId, user.id);
    return this.swaps.respond(swapId, membership, false);
  }

  @Post('swaps/:swapId/cancel')
  async cancelSwap(
    @CurrentUser() user: SafeUser,
    @Param('swapId') swapId: string,
  ) {
    const membership = await this.membershipForSwap(swapId, user.id);
    return this.swaps.cancel(swapId, membership);
  }

  /** Resolves the caller's membership in the swap's circle (404 otherwise). */
  private async membershipForSwap(swapId: string, userId: string) {
    const swap = await this.swapRepo.findOne({
      where: { id: swapId },
      select: { id: true, circleId: true },
    });
    if (!swap) throw new NotFoundException('Swap request not found');
    return this.member.requireMembership(swap.circleId, userId);
  }
}
