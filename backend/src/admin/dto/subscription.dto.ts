import { IsEnum } from 'class-validator';
import { SubscriptionStatus } from '../../entities';

export class UpdateSubscriptionStatusDto {
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;
}
