import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CirclesModule } from '../circles/circles.module';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';

@Module({
  imports: [AuthModule, CirclesModule],
  controllers: [MemberController],
  providers: [MemberService],
})
export class MemberModule {}
