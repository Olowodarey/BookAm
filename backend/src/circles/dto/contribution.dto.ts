import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectContributionDto {
  /** Shown to the member so they can re-submit a correct receipt. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason!: string;
}
