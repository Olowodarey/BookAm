import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  GoogleSignInDto,
  LinkPhoneDto,
  RegisterDto,
  ResendOtpDto,
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

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<OtpSentResponse> {
    return this.authService.forgotPassword(dto.phone);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto): Promise<LoginResponse> {
    return this.authService.resetPassword(
      dto.phone,
      dto.code,
      dto.newPassword,
    );
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
}
