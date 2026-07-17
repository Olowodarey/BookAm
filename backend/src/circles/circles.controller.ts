import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { SafeUser } from '../auth/auth.types';
import { CirclesService } from './circles.service';
import { MembersService } from './members.service';
import { ContributionsService } from './contributions.service';
import { PayoutsService } from './payouts.service';
import { AppealsService } from './appeals.service';
import { MAX_RECEIPT_BYTES, type ReceiptFile } from './receipt-storage.service';
import { CreateCircleDto } from './dto/circle.dto';
import { AddMemberDto, ReorderMembersDto } from './dto/member.dto';
import { RejectContributionDto } from './dto/contribution.dto';
import { DecideAppealDto } from './dto/appeal.dto';

const receiptUpload = () =>
  FileInterceptor('file', { limits: { fileSize: MAX_RECEIPT_BYTES } });

/**
 * Coordinator workspace API. Everything is scoped server-side: each service
 * call starts from CirclesService.assertOwned, so a coordinator can only
 * reach circles (and members/contributions/payouts) they own.
 */
@Controller('circles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COORDINATOR')
export class CirclesController {
  constructor(
    private readonly circles: CirclesService,
    private readonly members: MembersService,
    private readonly contributions: ContributionsService,
    private readonly payouts: PayoutsService,
    private readonly appeals: AppealsService,
  ) {}

  // ---- Circles ------------------------------------------------------------

  @Get()
  list(@CurrentUser() user: SafeUser) {
    return this.circles.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateCircleDto) {
    return this.circles.create(user.id, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.circles.detail(id, user.id);
  }

  // ---- Members ------------------------------------------------------------

  @Post(':id/members')
  addMember(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.members.add(id, user.id, dto);
  }

  @Delete(':id/members/:membershipId')
  removeMember(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.members.remove(id, user.id, membershipId);
  }

  @Patch(':id/members/order')
  reorderMembers(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: ReorderMembersDto,
  ) {
    return this.members.reorder(id, user.id, dto.orderedMembershipIds);
  }

  // ---- Invite link ---------------------------------------------------------

  @Post(':id/invite')
  generateInvite(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.members.generateInvite(id, user.id);
  }

  @Delete(':id/invite')
  disableInvite(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.members.disableInvite(id, user.id);
  }

  // ---- Contribution receipts ----------------------------------------------

  @Post(':id/contributions/:contributionId/receipt')
  @UseInterceptors(receiptUpload())
  attachContributionReceipt(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
    @UploadedFile() file: ReceiptFile | undefined,
  ) {
    return this.contributions.attachReceipt(id, user.id, contributionId, file);
  }

  @Post(':id/contributions/:contributionId/verify')
  verifyContribution(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
  ) {
    return this.contributions.verify(id, user.id, contributionId);
  }

  @Post(':id/contributions/:contributionId/reject')
  rejectContribution(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('contributionId') contributionId: string,
    @Body() dto: RejectContributionDto,
  ) {
    return this.contributions.reject(id, user.id, contributionId, dto.reason);
  }

  // ---- Payout --------------------------------------------------------------

  @Post(':id/payout/receipt')
  @UseInterceptors(receiptUpload())
  attachPayoutReceipt(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @UploadedFile() file: ReceiptFile | undefined,
  ) {
    return this.payouts.attachReceipt(id, user.id, file);
  }

  @Post(':id/payout/complete')
  completePayout(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.payouts.complete(id, user.id);
  }

  // ---- Reminders -----------------------------------------------------------

  @Get(':id/reminders')
  reminders(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.contributions.reminders(id, user.id);
  }

  // ---- Appeals (coordinator decides; member voting is advisory) -----------

  @Get(':id/appeals')
  async listAppeals(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    await this.circles.assertOwned(id, user.id);
    return this.appeals.list(id, null);
  }

  @Post(':id/appeals/:appealId/approve')
  approveAppeal(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('appealId') appealId: string,
    @Body() dto: DecideAppealDto,
  ) {
    return this.appeals.decide(id, user.id, appealId, true, dto.outcomeNote);
  }

  @Post(':id/appeals/:appealId/reject')
  rejectAppeal(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('appealId') appealId: string,
    @Body() dto: DecideAppealDto,
  ) {
    return this.appeals.decide(id, user.id, appealId, false, dto.outcomeNote);
  }
}
