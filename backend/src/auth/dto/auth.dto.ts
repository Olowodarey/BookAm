import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const PHONE_MESSAGE = 'phone must be digits only, e.g. +2348012345678';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72)
  password!: string;
}

export class VerifyPhoneDto {
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone!: string;

  @Matches(/^[0-9]{6}$/, { message: 'code must be the 6-digit number we sent' })
  code!: string;

  /** Present when completing a Google sign-in that needed a phone. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  linkToken?: string;
}

export class ResendOtpDto {
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone!: string;
}

export class GoogleSignInDto {
  /** The ID token from Google Identity Services on the frontend. */
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class LinkPhoneDto {
  @IsString()
  @IsNotEmpty()
  linkToken!: string;

  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone!: string;
}
