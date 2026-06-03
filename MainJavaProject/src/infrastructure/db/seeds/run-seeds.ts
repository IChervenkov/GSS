// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { withTransaction } = require('../transaction');

function getSeedDir({ environment = process.env.NODE_ENV || 'development' } = {}) {
  const normalized = environment === 'test' ? 'test' : 'dev';
  return path.join(__dirname, 'sql', normalized);
}

function getSeedFiles(seedDir) {
  if (!fs.existsSync(seedDir)) return [];
  return fs
    .readdirSync(seedDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

async function runSeeds({ environment, logger } = {}) {
  const seedDir = getSeedDir({ environment });
  const files = getSeedFiles(seedDir);

  return withTransaction(async (client) => {
    await client.query('SET search_path TO app, public');

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedDir, file), 'utf8');
      logger?.info?.('db_seed_started', {
        environment: environment || process.env.NODE_ENV || 'development',
        file,
      });
      await client.query(sql);
      logger?.info?.('db_seed_completed', {
        environment: environment || process.env.NODE_ENV || 'development',
        file,
      });
    }
  });
}

module.exports = { runSeeds };
