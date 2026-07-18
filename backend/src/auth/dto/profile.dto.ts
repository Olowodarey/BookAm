import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

/**
 * Settings update. Every field is optional; sending an empty string clears
 * the value. The primary phone is NOT editable here — it is the account's
 * identity and would need a fresh OTP flow to change.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => o.altPhone !== '')
  @Matches(PHONE_PATTERN, {
    message: 'altPhone must be digits only, e.g. +2348012345678',
  })
  altPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => o.bankAccountNumber !== '')
  @Matches(/^[0-9]{10}$/, {
    message: 'bankAccountNumber must be the 10-digit NUBAN number',
  })
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankAccountName?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(72)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @Matches(PHONE_PATTERN, {
    message: 'phone must be digits only, e.g. +2348012345678',
  })
  phone!: string;
}

export class ResetPasswordDto {
  @Matches(PHONE_PATTERN, {
    message: 'phone must be digits only, e.g. +2348012345678',
  })
  phone!: string;

  @Matches(/^[0-9]{6}$/, { message: 'code must be the 6-digit number we sent' })
  code!: string;

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(72)
  newPassword!: string;
}
