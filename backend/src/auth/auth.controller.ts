import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  GoogleSignInDto,
  RegisterDto,
  ResendEmailOtpDto,
  SendPhoneOtpDto,
  VerifyEmailDto,
  VerifyPhoneDto,
} from './dto/auth.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './roles';
import type { LoginResponse, OtpSentResponse, SafeUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto.email, dto.password);
  }

  /** Everyone starts as a contributor; collector comes later by application. */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<OtpSentResponse> {
    return this.authService.register(dto.name, dto.email, dto.password);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<LoginResponse> {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: ResendEmailOtpDto): Promise<OtpSentResponse> {
    return this.authService.resendEmailOtp(dto.email);
  }

  @Post('google')
  google(@Body() dto: GoogleSignInDto): Promise<LoginResponse> {
    return this.authService.googleSignIn(dto.idToken);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<OtpSentResponse> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto): Promise<LoginResponse> {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: SafeUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.authService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: SafeUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ---- Optional in-app phone/WhatsApp verification -------------------------

  @UseGuards(JwtAuthGuard)
  @Post('phone/send-otp')
  sendPhoneOtp(
    @CurrentUser() user: SafeUser,
    @Body() dto: SendPhoneOtpDto,
  ): Promise<OtpSentResponse> {
    return this.authService.sendPhoneOtp(user.id, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/verify')
  verifyPhone(
    @CurrentUser() user: SafeUser,
    @Body() dto: VerifyPhoneDto,
  ): Promise<SafeUser> {
    return this.authService.verifyPhone(user.id, dto.phone, dto.code);
  }
}
