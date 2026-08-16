import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Appeal,
  Circle,
  CollectorApplication,
  Contribution,
  ContributionReceipt,
  Cycle,
  Membership,
  Payout,
  User,
} from '../entities';
import { AuthModule } from '../auth/auth.module';
import { CirclesModule } from '../circles/circles.module';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Membership,
      Circle,
      Cycle,
      Contribution,
      ContributionReceipt,
      Payout,
      Appeal,
      CollectorApplication,
      User,
    ]),
    AuthModule,
    CirclesModule,
  ],
  controllers: [MemberController],
  providers: [MemberService],
})
export class MemberModule {}
