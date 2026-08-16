import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailOtp, Membership, PhoneOtp, User } from '../entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { EmailOtpService } from './email-otp.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Membership, PhoneOtp, EmailOtp]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-secret',
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    WhatsAppService,
    EmailService,
    EmailOtpService,
    JwtAuthGuard,
    RolesGuard,
  ],
  // Re-export the TypeORM feature so any module importing AuthModule can also
  // construct JwtAuthGuard (which needs the User repository) in its own context.
  exports: [TypeOrmModule, AuthService, EmailService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
