require('./register-typescript');

const env = require('../src/core/config/env');
const { createLogger } = require('../src/infrastructure/logging/logger');
const { runMigrations } = require('../src/infrastructure/db/migrations/migrate');
const { pool } = require('../src/infrastructure/db/pool');

(async () => {
  const logger = createLogger({ level: env.LOG_LEVEL, service: env.APP_NAME });
  await runMigrations({ logger });
  await pool.end();
})().catch(async (error) => {
  process.stderr.write(`${error?.stack || error?.message || error}\n`);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
