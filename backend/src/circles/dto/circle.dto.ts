import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
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

  /** The coordinator's cut as a whole percent of the pot (0–100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  feePercent?: number;
}

/** Coordinator settings a circle allows changing after creation. */
export class UpdateCircleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  feePercent?: number;
}
