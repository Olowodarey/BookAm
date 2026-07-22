import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Circle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { CirclesService } from './circles.service';
import type { InviteMemberDto } from './dto/member.dto';
import type {
  InviteLinkResponse,
  InvitePreview,
  MemberInfo,
} from './circles.types';

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:3000';
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
    private readonly email: EmailService,
  ) {}

  /**
   * Invite someone into the circle by Gmail. Emails them the invite either way:
   * if they already have a BookAm account they accept from their dashboard; if
   * not, the email links them to sign up, and the invite is claimed when they
   * register with that same Gmail. Every member ends up a real account (that's
   * how they upload their own receipts).
   */
  async invite(
    circleId: string,
    coordinatorId: string,
    dto: InviteMemberDto,
  ): Promise<MemberInfo> {
    const circle = await this.circles.assertOwned(circleId, coordinatorId);
    const email = dto.email.trim().toLowerCase();
    const coordinator = await this.prisma.user.findUniqueOrThrow({
      where: { id: coordinatorId },
    });
    const user = await this.prisma.user.findUnique({ where: { email } });
    await this.assertNotAlreadyInvited(circleId, email, user?.id ?? null);

    const membership = await this.prisma.membership.create({
      data: {
        circleId,
        userId: user?.id ?? null,
        name: user?.name ?? email.split('@')[0],
        phone: user?.phone ?? null,
        invitedEmail: email,
        status: 'INVITED',
      },
    });

    // Best-effort email — never fail the invite if the mail can't be sent.
    await this.sendInviteEmail(
      email,
      circle.name,
      coordinator.name,
      !!user,
    ).catch(() => undefined);

    return this.circles.toMemberInfo(membership, new Set(), email);
  }

  private async sendInviteEmail(
    to: string,
    circleName: string,
    coordinatorName: string,
    hasAccount: boolean,
  ): Promise<void> {
    const base = frontendUrl();
    const body = hasAccount
      ? `${coordinatorName} has invited you to join the circle "${circleName}" on BookAm.\n\n` +
        `Open your dashboard to accept the invite:\n${base}/me\n\n` +
        `You'll see it under "Circle invites".`
      : `${coordinatorName} has invited you to join the circle "${circleName}" on BookAm.\n\n` +
        `You don't have a BookAm account yet. Sign up with THIS Gmail (${to}) — ` +
        `you can use "Continue with Google" — and the invite will be waiting for you:\n${base}/register\n\n` +
        `Once you sign in, accept it under "Circle invites".`;
    await this.email.send(
      to,
      `You're invited to ${circleName} on BookAm`,
      body,
    );
  }

  /**
   * The coordinator opts into their own circle's rotation (they can run a
   * circle without contributing). Adds their account straight as ACTIVE.
   */
  async joinSelf(circleId: string, coordinatorId: string): Promise<MemberInfo> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const existing = await this.prisma.membership.findFirst({
      where: {
        circleId,
        userId: coordinatorId,
        status: { in: ['INVITED', 'REQUESTED', 'ACTIVE'] },
      },
    });
    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new ConflictException('You are already in this circle');
      }
      await this.circles.activate(existing.id);
    } else {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: coordinatorId },
      });
      const created = await this.prisma.membership.create({
        data: {
          circleId,
          userId: coordinatorId,
          name: user.name,
          phone: user.phone,
          status: 'INVITED',
        },
      });
      await this.circles.activate(created.id);
    }
    const membership = await this.prisma.membership.findFirstOrThrow({
      where: { circleId, userId: coordinatorId },
      include: { user: { select: { email: true } } },
    });
    const collectedIds = await this.circles.collectedMembershipIds(circleId);
    return this.circles.toMemberInfo(
      membership,
      collectedIds,
      membership.user?.email ?? null,
    );
  }

  /** The coordinator leaves their own circle's rotation (soft-remove). */
  async leaveSelf(
    circleId: string,
    coordinatorId: string,
  ): Promise<{ removed: true }> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const membership = await this.prisma.membership.findFirst({
      where: { circleId, userId: coordinatorId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new NotFoundException('You are not in this circle');
    }
    await this.prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' },
    });
    return { removed: true };
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

  /** Guard against a duplicate invite/membership — by account and by Gmail. */
  private async assertNotAlreadyInvited(
    circleId: string,
    email: string,
    userId: string | null,
  ): Promise<void> {
    const existing = await this.prisma.membership.findFirst({
      where: {
        circleId,
        status: { in: ['INVITED', 'REQUESTED', 'ACTIVE'] },
        OR: [{ invitedEmail: email }, ...(userId ? [{ userId }] : [])],
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
