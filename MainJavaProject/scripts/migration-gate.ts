require('./register-typescript');

const env = require('../src/core/config/env');
const { createLogger } = require('../src/infrastructure/logging/logger');
const { runMigrations } = require('../src/infrastructure/db/migrations/migrate');
const { pool } = require('../src/infrastructure/db/pool');

const executionMode = process.env.DB_MIGRATION_EXECUTION_MODE || 'ci-gate';

(async () => {
  const logger = createLogger({ level: env.LOG_LEVEL, service: env.APP_NAME });
  await runMigrations({
    logger,
    env,
    executionMode,
    gateToken: env.DB_MIGRATION_GATE_TOKEN,
    releaseId: env.DB_MIGRATION_RELEASE_ID,
    appliedBy: env.DB_MIGRATION_APPLIED_BY || `ci:${process.env.GITHUB_ACTOR || 'unknown'}`,
  });
  process.stdout.write(`Migration gate passed in ${executionMode} mode.\n`);
  await pool.end();
})().catch(async (error) => {
  process.stderr.write(`Migration gate failed: ${error?.stack || error?.message || error}\n`);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
