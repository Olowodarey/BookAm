import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entities } from '../entities';
import { UuidSubscriber } from './uuid.subscriber';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run) and the
 * seed script. The Nest app configures its own connection in AppModule via
 * TypeOrmModule.forRootAsync — this mirrors that config for out-of-Nest tooling.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities,
  subscribers: [UuidSubscriber],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
