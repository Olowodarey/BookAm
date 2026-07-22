import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsString,
} from 'class-validator';

/** Coordinator invites an existing BookAm account into the circle by email. */
export class InviteMemberDto {
  @IsEmail({}, { message: 'enter a valid email address' })
  email!: string;
}

export class ReorderMembersDto {
  /** Every ACTIVE membership id of the circle, in the new rotation order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedMembershipIds!: string[];
}
