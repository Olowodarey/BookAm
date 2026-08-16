import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { UuidEntity } from '../entities/base.entity';

/**
 * Assigns a time-ordered UUIDv7 id to any UuidEntity that doesn't already have
 * one, just before insert. Runs on repository `save()` (the only insert path the
 * services use). PlatformSettings keeps its fixed integer id and is untouched.
 */
@EventSubscriber()
export class UuidSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<unknown>): void {
    const entity = event.entity;
    if (entity instanceof UuidEntity && !entity.id) {
      entity.id = uuidv7();
    }
  }
}
