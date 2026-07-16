import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ApplicationWithPeople, Paginated } from './admin.types';
import type { ListApplicationsDto } from './dto/query.dto';
import { safeUserSelect } from './safe-user.select';

const withPeople = {
  applicant: { select: safeUserSelect },
  reviewedBy: { select: safeUserSelect },
} satisfies Prisma.CollectorApplicationInclude;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListApplicationsDto,
  ): Promise<Paginated<ApplicationWithPeople>> {
    const where: Prisma.CollectorApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            applicant: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.collectorApplication.findMany({
        where,
        include: withPeople,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.collectorApplication.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<ApplicationWithPeople> {
    const application = await this.prisma.collectorApplication.findUnique({
      where: { id },
      include: withPeople,
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  async approve(
    id: string,
    reviewerId: string,
    reviewNote?: string,
  ): Promise<ApplicationWithPeople> {
    const application = await this.get(id);
    if (application.status !== 'PENDING') {
      throw new ConflictException('This application has already been reviewed');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.collectorApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewNote: reviewNote ?? null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: withPeople,
      }),
      // Promote member → coordinator; never demote an admin applicant.
      this.prisma.user.updateMany({
        where: { id: application.applicantId, role: 'MEMBER' },
        data: { role: 'COORDINATOR' },
      }),
    ]);

    return this.get(updated.id);
  }

  async reject(
    id: string,
    reviewerId: string,
    reviewNote?: string,
  ): Promise<ApplicationWithPeople> {
    const application = await this.get(id);
    if (application.status !== 'PENDING') {
      throw new ConflictException('This application has already been reviewed');
    }

    return this.prisma.collectorApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote: reviewNote ?? null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: withPeople,
    });
  }
}
