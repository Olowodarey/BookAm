import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSwapDto {
  /** The membership the requester wants to swap rotation positions with. */
  @IsUUID()
  targetMembershipId!: string;

  /** Optional short note shown to the target + coordinator. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  note?: string;
}

export class DecideSwapDto {
  /** Optional coordinator note recorded with the decision. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  note?: string;
}
