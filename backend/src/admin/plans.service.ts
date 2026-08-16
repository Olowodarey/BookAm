import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan } from '../entities';
import { isUniqueViolation } from '../database/db-errors';
import type { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly plans: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
  ) {}

  list(): Promise<SubscriptionPlan[]> {
    return this.plans.find({ order: { priceNaira: 'ASC' } });
  }

  async get(id: string): Promise<SubscriptionPlan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<SubscriptionPlan> {
    try {
      return await this.plans.save(
        this.plans.create({
          name: dto.name,
          priceNaira: dto.priceNaira,
          interval: dto.interval,
          maxCircles: dto.maxCircles ?? null,
          features: dto.features ?? [],
          active: dto.active ?? true,
        }),
      );
    } catch (e) {
      this.rethrowDuplicateName(e);
    }
  }

  async update(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
    const plan = await this.get(id);
    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.priceNaira !== undefined) plan.priceNaira = dto.priceNaira;
    if (dto.interval !== undefined) plan.interval = dto.interval;
    if (dto.maxCircles !== undefined) plan.maxCircles = dto.maxCircles;
    if (dto.features !== undefined) plan.features = dto.features;
    if (dto.active !== undefined) plan.active = dto.active;
    try {
      return await this.plans.save(plan);
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
    const subscribers = await this.subscriptions.count({
      where: { planId: id },
    });
    if (subscribers > 0) {
      plan.active = false;
      const deactivated = await this.plans.save(plan);
      return { deleted: false, plan: deactivated };
    }
    await this.plans.delete({ id });
    return { deleted: true, plan };
  }

  private rethrowDuplicateName(e: unknown): never {
    if (isUniqueViolation(e)) {
      throw new ConflictException('A plan with this name already exists');
    }
    throw e;
  }
}
