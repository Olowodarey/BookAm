import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Circle, CollectorApplication, Subscription, User } from '../entities';
import { toSafeUser } from '../auth/auth.service';
import type { SafeUser } from '../auth/auth.types';
import type { Paginated, UserDetail } from './admin.types';
import type { ListUsersDto } from './dto/query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Circle) private readonly circles: Repository<Circle>,
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(CollectorApplication)
    private readonly applications: Repository<CollectorApplication>,
  ) {}

  async list(query: ListUsersDto): Promise<Paginated<SafeUser>> {
    const base: FindOptionsWhere<User> = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
    };
    // Search matches name (case-insensitive) OR phone — an array of where
    // clauses is TypeORM's OR, so we duplicate the base filters into each.
    const where: FindOptionsWhere<User> | FindOptionsWhere<User>[] =
      query.search
        ? [
            { ...base, name: ILike(`%${query.search}%`) },
            { ...base, phone: ILike(`%${query.search}%`) },
          ]
        : base;

    const [items, total] = await this.users.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items: items.map(toSafeUser),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<UserDetail> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const [coordinatedCircles, subscriptions, applications] = await Promise.all(
      [
        this.circles.count({ where: { coordinatorId: id } }),
        this.subscriptions.count({ where: { userId: id } }),
        this.applications.count({ where: { applicantId: id } }),
      ],
    );

    return {
      ...toSafeUser(user),
      updatedAt: user.updatedAt,
      counts: { coordinatedCircles, subscriptions, applications },
    };
  }

  async suspend(id: string, actingAdminId: string): Promise<SafeUser> {
    if (id === actingAdminId) {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot be suspended');
    }
    user.status = 'SUSPENDED';
    return toSafeUser(await this.users.save(user));
  }

  async reactivate(id: string): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.status = 'ACTIVE';
    return toSafeUser(await this.users.save(user));
  }
}
