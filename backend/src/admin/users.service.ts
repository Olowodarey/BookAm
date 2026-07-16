import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SafeUser } from '../auth/auth.types';
import type { Paginated, UserDetail } from './admin.types';
import type { ListUsersDto } from './dto/query.dto';
import { safeUserSelect } from './safe-user.select';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersDto): Promise<Paginated<SafeUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        updatedAt: true,
        _count: {
          select: {
            coordinatedCircles: true,
            subscriptions: true,
            applications: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { _count, ...rest } = user;
    return {
      ...rest,
      counts: {
        coordinatedCircles: _count.coordinatedCircles,
        subscriptions: _count.subscriptions,
        applications: _count.applications,
      },
    };
  }

  async suspend(id: string, actingAdminId: string): Promise<SafeUser> {
    if (id === actingAdminId) {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot be suspended');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
      select: safeUserSelect,
    });
  }

  async reactivate(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: safeUserSelect,
    });
  }
}
