import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @IsEmail({}, { message: 'enter a valid email address' })
  email!: string;

  /** Which part of the site they signed up from (e.g. "hero", "final-cta"). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}
