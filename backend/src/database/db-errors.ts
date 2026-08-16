import { QueryFailedError } from 'typeorm';

/** Postgres unique-constraint violation (was Prisma's P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof QueryFailedError &&
    (e.driverError as { code?: string } | undefined)?.code === '23505'
  );
}
