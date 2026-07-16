import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { SafeUser } from '../auth/auth.types';
import { OverviewService } from './overview.service';
import { ApplicationsService } from './applications.service';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from './users.service';
import { ReviewApplicationDto } from './dto/application.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { UpdateSubscriptionStatusDto } from './dto/subscription.dto';
import {
  ListApplicationsDto,
  ListSubscriptionsDto,
  ListUsersDto,
} from './dto/query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly overview: OverviewService,
    private readonly applications: ApplicationsService,
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionsService,
    private readonly users: UsersService,
  ) {}

  // ---- Overview -----------------------------------------------------------

  @Get('overview')
  getOverview() {
    return this.overview.metrics();
  }

  // ---- Collector applications ---------------------------------------------

  @Get('applications')
  listApplications(@Query() query: ListApplicationsDto) {
    return this.applications.list(query);
  }

  @Get('applications/:id')
  getApplication(@Param('id') id: string) {
    return this.applications.get(id);
  }

  @Post('applications/:id/approve')
  approveApplication(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentUser() admin: SafeUser,
  ) {
    return this.applications.approve(id, admin.id, dto.reviewNote);
  }

  @Post('applications/:id/reject')
  rejectApplication(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentUser() admin: SafeUser,
  ) {
    return this.applications.reject(id, admin.id, dto.reviewNote);
  }

  // ---- Subscription plans ---------------------------------------------------

  @Get('plans')
  listPlans() {
    return this.plans.list();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete('plans/:id')
  removePlan(@Param('id') id: string) {
    return this.plans.remove(id);
  }

  // ---- Subscriptions --------------------------------------------------------

  @Get('subscriptions')
  listSubscriptions(@Query() query: ListSubscriptionsDto) {
    return this.subscriptions.list(query);
  }

  @Patch('subscriptions/:id/status')
  updateSubscriptionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
  ) {
    return this.subscriptions.updateStatus(id, dto.status);
  }

  // ---- Users ----------------------------------------------------------------

  @Get('users')
  listUsers(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string, @CurrentUser() admin: SafeUser) {
    return this.users.suspend(id, admin.id);
  }

  @Post('users/:id/reactivate')
  reactivateUser(@Param('id') id: string) {
    return this.users.reactivate(id);
  }
}
