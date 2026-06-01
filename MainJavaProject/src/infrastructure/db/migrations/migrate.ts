const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withTransaction } = require('../transaction');
const { getMigrationMeta } = require('./migration-manifest');

const MIGRATIONS_DIR = path.join(__dirname, 'sql');

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function checksumFor(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app.schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      phase text NOT NULL,
      risk text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      applied_by text,
      execution_mode text NOT NULL DEFAULT 'manual',
      release_id text,
      gate_token text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await client.query(`
    ALTER TABLE app.schema_migrations
      ADD COLUMN IF NOT EXISTS phase text,
      ADD COLUMN IF NOT EXISTS risk text,
      ADD COLUMN IF NOT EXISTS applied_by text,
      ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS release_id text,
      ADD COLUMN IF NOT EXISTS gate_token text,
      ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  `);
}

function validateMigrationPolicy({ env, version, executionMode, gateToken }) {
  const meta = getMigrationMeta(version);
  const isProdLike = Boolean(env?.isProdLike);
  const automaticExecution = executionMode !== 'manual';

  if (automaticExecution && !meta.safeOnBoot) {
    throw new Error(
      `Migration ${version} is phase=${meta.phase} risk=${meta.risk} and is not allowed for automatic runtime execution.`,
    );
  }

  if (meta.requiresManualGate && !gateToken) {
    throw new Error(`Migration ${version} requires an explicit migration gate token.`);
  }

  if (isProdLike && automaticExecution && (meta.phase === 'switch' || meta.phase === 'contract')) {
    throw new Error(
      `Migration ${version} is a ${meta.phase} migration and must be run manually through the deployment gate in staging/production.`,
    );
  }

  if (isProdLike && automaticExecution && meta.risk === 'high') {
    throw new Error(`High-risk migration ${version} cannot run automatically in staging/production.`);
  }

  return meta;
}

async function runMigrations({ logger, env, executionMode = 'manual', appliedBy, releaseId, gateToken } = {}) {
  const files = getMigrationFiles();

  return withTransaction(async (client) => {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query('SET search_path TO app, public');
    await ensureMigrationsTable(client);

    for (const file of files) {
      const absolutePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(absolutePath, 'utf8');
      const checksum = checksumFor(sql);
      const version = file.replace(/\.sql$/i, '');
      const meta = getMigrationMeta(version);

      const existing = await client.query(
        'SELECT version, checksum, phase, risk FROM app.schema_migrations WHERE version = $1 LIMIT 1',
        [version],
      );

      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${file}. Create a new forward migration instead of editing an applied one.`,
          );
        }
        continue;
      }

      validateMigrationPolicy({ env, version, executionMode, gateToken });

      logger?.info?.('db_migration_started', {
        version,
        file,
        phase: meta.phase,
        risk: meta.risk,
        executionMode,
        releaseId,
      });

      await client.query(sql);
      await client.query(
        `INSERT INTO app.schema_migrations (
          version,
          checksum,
          phase,
          risk,
          applied_by,
          execution_mode,
          release_id,
          gate_token,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          version,
          checksum,
          meta.phase,
          meta.risk,
          appliedBy || null,
          executionMode,
          releaseId || null,
          gateToken || null,
          JSON.stringify({ summary: meta.summary, rollback: meta.rollback }),
        ],
      );
      logger?.info?.('db_migration_completed', {
        version,
        file,
        phase: meta.phase,
        risk: meta.risk,
        executionMode,
        releaseId,
      });
    }
  });
}

module.exports = { runMigrations };
