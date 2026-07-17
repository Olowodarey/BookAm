import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CircleFrequency } from '@prisma/client';

export class CreateCircleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountNaira!: number;

  @IsEnum(CircleFrequency)
  frequency!: CircleFrequency;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(200)
  memberTarget!: number;
}
