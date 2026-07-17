import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyCollectorDto {
  /** Why they want to run circles — shown to the admin reviewing it. */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  note!: string;
}
