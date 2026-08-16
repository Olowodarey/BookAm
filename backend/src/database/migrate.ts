import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from './data-source';

/**
 * Standalone migration runner for deploys (Railway preDeploy). Uses the
 * DataSource directly instead of the `typeorm` CLI via npx — npx can try to
 * hit the network and pnpm's node_modules layout can confuse binary
 * resolution, both of which failed silently in the deploy step. Plain `node`
 * on the compiled output is deterministic and logs clearly.
 */
async function main(): Promise<void> {
  console.log('[migrate] initializing data source…');
  await AppDataSource.initialize();
  console.log('[migrate] running migrations…');
  const applied = await AppDataSource.runMigrations();
  if (applied.length === 0) {
    console.log('[migrate] no pending migrations.');
  } else {
    for (const m of applied) console.log(`[migrate] applied ${m.name}`);
  }
  await AppDataSource.destroy();
  console.log('[migrate] done.');
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
