import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  GoogleSignInDto,
  LinkPhoneDto,
  RegisterDto,
  ResendOtpDto,
  VerifyPhoneDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './roles';
import type {
  GoogleSignInResponse,
  LoginResponse,
  OtpSentResponse,
  SafeUser,
} from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto.phone, dto.password);
  }

  /** Everyone starts as a contributor; collector comes later by application. */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<OtpSentResponse> {
    return this.authService.register(dto.name, dto.phone, dto.password);
  }

  @Post('verify-phone')
  verifyPhone(@Body() dto: VerifyPhoneDto): Promise<LoginResponse> {
    return this.authService.verifyPhone(dto.phone, dto.code, dto.linkToken);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto): Promise<OtpSentResponse> {
    return this.authService.resendOtp(dto.phone);
  }

  @Post('google')
  google(@Body() dto: GoogleSignInDto): Promise<GoogleSignInResponse> {
    return this.authService.googleSignIn(dto.idToken);
  }

  @Post('google/link-phone')
  linkPhone(@Body() dto: LinkPhoneDto): Promise<OtpSentResponse> {
    return this.authService.linkPhone(dto.linkToken, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }
}
