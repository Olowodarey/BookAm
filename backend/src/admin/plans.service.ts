import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceNaira: 'asc' },
    });
  }

  async get(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<SubscriptionPlan> {
    try {
      return await this.prisma.subscriptionPlan.create({
        data: {
          name: dto.name,
          priceNaira: dto.priceNaira,
          interval: dto.interval,
          maxCircles: dto.maxCircles ?? null,
          features: dto.features ?? [],
          active: dto.active ?? true,
        },
      });
    } catch (e) {
      this.rethrowDuplicateName(e);
    }
  }

  async update(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
    await this.get(id);
    try {
      return await this.prisma.subscriptionPlan.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.priceNaira !== undefined
            ? { priceNaira: dto.priceNaira }
            : {}),
          ...(dto.interval !== undefined ? { interval: dto.interval } : {}),
          ...(dto.maxCircles !== undefined
            ? { maxCircles: dto.maxCircles }
            : {}),
          ...(dto.features !== undefined ? { features: dto.features } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    } catch (e) {
      this.rethrowDuplicateName(e);
    }
  }

  /**
   * Hard-deletes a plan with no subscriptions; otherwise deactivates it so
   * existing subscription records stay intact.
   */
  async remove(
    id: string,
  ): Promise<{ deleted: boolean; plan: SubscriptionPlan }> {
    const plan = await this.get(id);
    const subscribers = await this.prisma.subscription.count({
      where: { planId: id },
    });
    if (subscribers > 0) {
      const deactivated = await this.prisma.subscriptionPlan.update({
        where: { id },
        data: { active: false },
      });
      return { deleted: false, plan: deactivated };
    }
    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { deleted: true, plan };
  }

  private rethrowDuplicateName(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException('A plan with this name already exists');
    }
    throw e;
  }
}
