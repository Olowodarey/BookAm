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
import type { AddMemberDto, JoinCircleDto } from './dto/member.dto';
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

  async add(
    circleId: string,
    coordinatorId: string,
    dto: AddMemberDto,
  ): Promise<MemberInfo> {
    await this.circles.assertOwned(circleId, coordinatorId);
    const membership = await this.createMembership(circleId, dto);
    const collectedIds = await this.circles.collectedMembershipIds(circleId);
    return this.circles.toMemberInfo(membership, collectedIds);
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

    const [members, collectedIds] = await Promise.all([
      this.circles.activeMembers(circleId),
      this.circles.collectedMembershipIds(circleId),
    ]);
    // The rotation changed, so the open cycle's collector may have too.
    await this.circles.openCycleState(circle);
    return members.map((m) => this.circles.toMemberInfo(m, collectedIds));
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

  // ---- Public invite flow (no auth — the token is the credential) ---------

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

  async join(
    token: string,
    dto: JoinCircleDto,
  ): Promise<{ joined: true; circleName: string }> {
    const circle = await this.circleByToken(token);
    const activeMembers = await this.prisma.membership.count({
      where: { circleId: circle.id, status: 'ACTIVE' },
    });
    if (circle.memberTarget > 0 && activeMembers >= circle.memberTarget) {
      throw new ConflictException(
        'This circle is already full — ask the coordinator for space',
      );
    }
    await this.createMembership(circle.id, dto);
    return { joined: true, circleName: circle.name };
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

  private async createMembership(circleId: string, dto: AddMemberDto) {
    const duplicate = await this.prisma.membership.findFirst({
      where: { circleId, phone: dto.phone, status: 'ACTIVE' },
    });
    if (duplicate) {
      throw new ConflictException(
        `${duplicate.name} is already in this circle with that phone number`,
      );
    }
    // New members go to the back of the rotation; the coordinator can reorder.
    const max = await this.prisma.membership.aggregate({
      where: { circleId },
      _max: { position: true },
    });
    return this.prisma.membership.create({
      data: {
        circleId,
        name: dto.name,
        phone: dto.phone,
        position: (max._max.position ?? 0) + 1,
        // Link to an existing BookAm account when the phone matches one.
        userId:
          (
            await this.prisma.user.findUnique({
              where: { phone: dto.phone },
              select: { id: true },
            })
          )?.id ?? null,
      },
    });
  }
}
