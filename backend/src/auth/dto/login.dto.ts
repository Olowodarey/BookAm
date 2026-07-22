import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'enter a valid email address' })
  // BookAm is Gmail-only — accounts sign in with a Google/Gmail identity.
  @Matches(/@gmail\.com$/i, { message: 'use a Gmail address (…@gmail.com)' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
