import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Circle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CirclesService } from './circles.service';
import type { InviteMemberDto } from './dto/member.dto';
import type {
  InviteLinkResponse,
  InvitePreview,
  MemberInfo,
} from './circles.types';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
  ) {}

  /**
   * Invite an existing BookAm account into the circle by email. Creates an
   * INVITED membership the person then accepts from their own dashboard —
   * every member is a real account (that's how they can send receipts).
   */
  async invite(
    circleId: string,
    coordinatorId: string,
    dto: InviteMemberDto,
  ): Promise<MemberInfo> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException(
        'No BookAm account has this email — ask them to sign up first, then invite again',
      );
    }
    await this.assertNotAlreadyInCircle(circleId, user.id);
    const membership = await this.prisma.membership.create({
      data: {
        circleId,
        userId: user.id,
        name: user.name,
        phone: user.phone,
        status: 'INVITED',
      },
    });
    return this.circles.toMemberInfo(membership, new Set(), user.email);
  }

  /** Coordinator approves a join request (REQUESTED → ACTIVE, gets a slot). */
  async approveRequest(
    circleId: string,
    coordinatorId: string,
    membershipId: string,
  ): Promise<MemberInfo> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const membership = await this.pendingInCircle(
      circleId,
      membershipId,
      'REQUESTED',
    );
    await this.circles.activate(membership.id);
    const updated = await this.prisma.membership.findUniqueOrThrow({
      where: { id: membership.id },
      include: { user: { select: { email: true } } },
    });
    const collectedIds = await this.circles.collectedMembershipIds(circleId);
    return this.circles.toMemberInfo(
      updated,
      collectedIds,
      updated.user?.email ?? null,
    );
  }

  /** Reject a join request or cancel an invite — drops the pending row. */
  async removePending(
    circleId: string,
    coordinatorId: string,
    membershipId: string,
  ): Promise<{ removed: true }> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (
      !membership ||
      membership.circleId !== circleId ||
      (membership.status !== 'REQUESTED' && membership.status !== 'INVITED')
    ) {
      throw new NotFoundException('No pending request or invite to remove');
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    return { removed: true };
  }

  async remove(
    circleId: string,
    coordinatorId: string,
    membershipId: string,
  ): Promise<{ removed: true }> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (
      !membership ||
      membership.circleId !== circleId ||
      membership.status !== 'ACTIVE'
    ) {
      throw new NotFoundException('Member not found in this circle');
    }
    // Soft-remove: their past contribution/payout records stay intact.
    // If they were this cycle's collector, openCycleState re-resolves it.
    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'REMOVED' },
    });
    return { removed: true };
  }

  async reorder(
    circleId: string,
    coordinatorId: string,
    orderedMembershipIds: string[],
  ): Promise<MemberInfo[]> {
    const circle = await this.circles.assertOwned(circleId, coordinatorId);
    const active = await this.circles.activeMembers(circleId);
    const activeIds = new Set(active.map((m) => m.id));
    const orderedIds = new Set(orderedMembershipIds);
    if (
      orderedMembershipIds.length !== active.length ||
      active.some((m) => !orderedIds.has(m.id)) ||
      orderedMembershipIds.some((id) => !activeIds.has(id))
    ) {
      throw new BadRequestException(
        'orderedMembershipIds must contain every active member of the circle exactly once',
      );
    }

    await this.prisma.$transaction(
      orderedMembershipIds.map((id, index) =>
        this.prisma.membership.update({
          where: { id },
          data: { position: index + 1 },
        }),
      ),
    );

    const [members, collectedIds, emails] = await Promise.all([
      this.circles.activeMembers(circleId),
      this.circles.collectedMembershipIds(circleId),
      this.circleMemberEmails(circleId),
    ]);
    // The rotation changed, so the open cycle's collector may have too.
    await this.circles.openCycleState(circle);
    return members.map((m) =>
      this.circles.toMemberInfo(m, collectedIds, emails.get(m.id) ?? null),
    );
  }

  async generateInvite(
    circleId: string,
    coordinatorId: string,
  ): Promise<InviteLinkResponse> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const inviteToken = randomBytes(12).toString('hex');
    await this.prisma.circle.update({
      where: { id: circleId },
      data: { inviteToken },
    });
    return { inviteToken, inviteUrl: this.inviteUrl(inviteToken) };
  }

  async disableInvite(
    circleId: string,
    coordinatorId: string,
  ): Promise<{ disabled: true }> {
    await this.circles.assertOwned(circleId, coordinatorId);
    await this.prisma.circle.update({
      where: { id: circleId },
      data: { inviteToken: null },
    });
    return { disabled: true };
  }

  inviteUrl(token: string): string {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return `${base}/join/${token}`;
  }

  // ---- Invite link flow ----------------------------------------------------

  /** Public preview of what an invite link leads to (no auth needed). */
  async preview(token: string): Promise<InvitePreview> {
    const circle = await this.circleByToken(token);
    const [coordinator, activeMembers] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: circle.coordinatorId } }),
      this.prisma.membership.count({
        where: { circleId: circle.id, status: 'ACTIVE' },
      }),
    ]);
    return {
      circleName: circle.name,
      coordinatorName: coordinator?.name ?? 'Coordinator',
      amountNaira: circle.contributionAmountNaira,
      frequency: circle.frequency,
      activeMembers,
      memberTarget: circle.memberTarget,
    };
  }

  /**
   * A signed-in user asks to join via the link. Creates a REQUESTED membership
   * the coordinator then approves — so nobody joins just by having the link.
   */
  async requestJoin(
    token: string,
    userId: string,
  ): Promise<{ requested: true; circleName: string }> {
    const circle = await this.circleByToken(token);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const existing = await this.prisma.membership.findFirst({
      where: {
        circleId: circle.id,
        userId,
        status: { in: ['INVITED', 'REQUESTED', 'ACTIVE'] },
      },
    });
    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new ConflictException('You are already in this circle');
      }
      if (existing.status === 'INVITED') {
        // They were invited — accept it straight away instead of duplicating.
        await this.circles.activate(existing.id);
        return { requested: true, circleName: circle.name };
      }
      throw new ConflictException(
        'You already have a pending request for this circle',
      );
    }
    await this.prisma.membership.create({
      data: {
        circleId: circle.id,
        userId,
        name: user.name,
        phone: user.phone,
        status: 'REQUESTED',
      },
    });
    return { requested: true, circleName: circle.name };
  }

  private async circleByToken(token: string): Promise<Circle> {
    const circle = await this.prisma.circle.findUnique({
      where: { inviteToken: token },
    });
    if (!circle || circle.status !== 'ACTIVE') {
      throw new NotFoundException(
        'This invite link is no longer valid — ask the coordinator for a new one',
      );
    }
    return circle;
  }

  private async assertNotAlreadyInCircle(
    circleId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.membership.findFirst({
      where: {
        circleId,
        userId,
        status: { in: ['INVITED', 'REQUESTED', 'ACTIVE'] },
      },
    });
    if (existing) {
      throw new ConflictException(
        'That person is already a member of (or invited to) this circle',
      );
    }
  }

  private async pendingInCircle(
    circleId: string,
    membershipId: string,
    status: 'REQUESTED' | 'INVITED',
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (
      !membership ||
      membership.circleId !== circleId ||
      membership.status !== status
    ) {
      throw new NotFoundException('No matching pending membership');
    }
    return membership;
  }

  private async circleMemberEmails(
    circleId: string,
  ): Promise<Map<string, string | null>> {
    const rows = await this.prisma.membership.findMany({
      where: { circleId },
      select: { id: true, user: { select: { email: true } } },
    });
    return new Map(rows.map((r) => [r.id, r.user?.email ?? null]));
  }
}
