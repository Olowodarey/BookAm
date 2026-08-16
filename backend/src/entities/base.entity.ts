import { PrimaryColumn } from 'typeorm';

/**
 * Base for entities keyed by a UUIDv7 string. The id is filled in on insert by
 * UuidSubscriber (see src/database/uuid.subscriber.ts) rather than a method on
 * this class — keeping entities free of private/method members so they stay
 * structurally compatible with the plain response objects the services build.
 */
export abstract class UuidEntity {
  @PrimaryColumn('uuid')
  id!: string;
}
