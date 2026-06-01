const { Pool } = require('pg');
const env = require('../../core/config/env');
const { metrics } = require('../../shared/observability/metrics');
const { getRequestContext } = require('../../shared/observability/request-context');

const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  max: env.DATABASE_MAX_CLIENTS,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

function observePoolState() {
  metrics.gaugeSet('gss_db_pool_total_clients', {}, Number(pool.totalCount || 0));
  metrics.gaugeSet('gss_db_pool_idle_clients', {}, Number(pool.idleCount || 0));
  metrics.gaugeSet('gss_db_pool_waiting_clients', {}, Number(pool.waitingCount || 0));
}

function inferStatementName(args) {
  const first = args[0];
  if (typeof first === 'string') return first.trim().split(/\s+/)[0]?.toUpperCase() || 'QUERY';
  if (first && typeof first === 'object') {
    if (first.name) return String(first.name);
    if (typeof first.text === 'string')
      return first.text.trim().split(/\s+/)[0]?.toUpperCase() || 'QUERY';
  }
  return 'QUERY';
}

function resolveRepositoryLabel() {
  const ctx = getRequestContext();
  return ctx.repository || ctx.module || 'unscoped';
}

async function observeQuery(executor, args) {
  const startedAt = process.hrtime.bigint();
  const statement = inferStatementName(args);
  const repository = resolveRepositoryLabel();
  try {
    const result = await executor(...args);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    metrics.counter('gss_db_queries_total', { repository, statement, status: 'ok' });
    metrics.histogramObserve(
      'gss_db_query_duration_ms',
      { repository, statement, status: 'ok' },
      durationMs,
    );
    observePoolState();
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    metrics.counter('gss_db_queries_total', { repository, statement, status: 'error' });
    metrics.histogramObserve(
      'gss_db_query_duration_ms',
      { repository, statement, status: 'error' },
      durationMs,
    );
    observePoolState();
    throw error;
  }
}

const originalPoolQuery = pool.query.bind(pool);
pool.query = (...args) => observeQuery(originalPoolQuery, args);

const originalConnect = pool.connect.bind(pool);
pool.connect = async (...args) => {
  observePoolState();
  const client = await originalConnect(...args);
  const originalClientQuery = client.query.bind(client);
  client.query = (...queryArgs) => observeQuery(originalClientQuery, queryArgs);
  const originalRelease = client.release.bind(client);
  client.release = (...releaseArgs) => {
    const result = originalRelease(...releaseArgs);
    observePoolState();
    return result;
  };
  observePoolState();
  return client;
};

pool.on('connect', async (client) => {
  await client.query('SET search_path TO app, public');
  observePoolState();
});

pool.on('error', () => {
  metrics.counter('gss_db_pool_errors_total');
  observePoolState();
});

observePoolState();

module.exports = { pool, observePoolState };
