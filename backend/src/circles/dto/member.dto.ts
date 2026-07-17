import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @Matches(PHONE_PATTERN, {
    message: 'phone must be digits only, e.g. +2348012345678',
  })
  phone!: string;
}

export class ReorderMembersDto {
  /** Every ACTIVE membership id of the circle, in the new rotation order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedMembershipIds!: string[];
}

/** Public: sent by a prospective member opening an invite link. */
export class JoinCircleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @Matches(PHONE_PATTERN, {
    message: 'phone must be digits only, e.g. +2348012345678',
  })
  phone!: string;
}
