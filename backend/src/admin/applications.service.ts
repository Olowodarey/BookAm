import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { CollectorApplication, User } from '../entities';
import { toSafeUser } from '../auth/auth.service';
import type { ApplicationWithPeople, Paginated } from './admin.types';
import type { ListApplicationsDto } from './dto/query.dto';

/** Strips applicant + reviewedBy down to SafeUser (no passwordHash). */
function toWithPeople(a: CollectorApplication): ApplicationWithPeople {
  const { applicant, reviewedBy, ...rest } = a;
  return {
    ...rest,
    applicant: toSafeUser(applicant),
    reviewedBy: reviewedBy ? toSafeUser(reviewedBy) : null,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(CollectorApplication)
    private readonly applications: Repository<CollectorApplication>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(
    query: ListApplicationsDto,
  ): Promise<Paginated<ApplicationWithPeople>> {
    const statusWhere: FindOptionsWhere<CollectorApplication> = query.status
      ? { status: query.status }
      : {};
    // Search matches the applicant's name (case-insensitive) OR phone.
    const where:
      | FindOptionsWhere<CollectorApplication>
      | FindOptionsWhere<CollectorApplication>[] = query.search
      ? [
          { ...statusWhere, applicant: { name: ILike(`%${query.search}%`) } },
          { ...statusWhere, applicant: { phone: ILike(`%${query.search}%`) } },
        ]
      : statusWhere;

    const [items, total] = await this.applications.findAndCount({
      where,
      relations: { applicant: true, reviewedBy: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items: items.map(toWithPeople),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<ApplicationWithPeople> {
    const application = await this.applications.findOne({
      where: { id },
      relations: { applicant: true, reviewedBy: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return toWithPeople(application);
  }

  async approve(
    id: string,
    reviewerId: string,
    reviewNote?: string,
  ): Promise<ApplicationWithPeople> {
    const application = await this.applications.findOne({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'PENDING') {
      throw new ConflictException('This application has already been reviewed');
    }

    application.status = 'APPROVED';
    application.reviewNote = reviewNote ?? null;
    application.reviewedById = reviewerId;
    application.reviewedAt = new Date();
    await this.applications.save(application);

    // Promote member → coordinator; never demote an admin applicant.
    await this.users.update(
      { id: application.applicantId, role: 'MEMBER' },
      { role: 'COORDINATOR' },
    );

    return this.get(id);
  }

  async reject(
    id: string,
    reviewerId: string,
    reviewNote?: string,
  ): Promise<ApplicationWithPeople> {
    const application = await this.applications.findOne({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'PENDING') {
      throw new ConflictException('This application has already been reviewed');
    }

    application.status = 'REJECTED';
    application.reviewNote = reviewNote ?? null;
    application.reviewedById = reviewerId;
    application.reviewedAt = new Date();
    await this.applications.save(application);

    return this.get(id);
  }
}
