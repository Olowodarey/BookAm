import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VoteValue } from '@prisma/client';

export class CreateAppealDto {
  /** Why the member wants to collect next — visible to the whole circle. */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(300)
  reason!: string;
}

export class VoteDto {
  @IsEnum(VoteValue)
  value!: VoteValue;
}

export class DecideAppealDto {
  /** Optional coordinator note shown to all members with the outcome. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  outcomeNote?: string;
}
