// @ts-nocheck
const defaultEnv = require('../../core/config/env');
const { metrics: defaultMetrics } = require('../../shared/observability/metrics');
const { withClient } = require('../db/transaction');

const DB_MAINTENANCE_LOCK_ID = 48217021;

async function markLateBicycleRentals(client) {
  const { rows } = await client.query(
    `WITH overdue AS (
       SELECT DISTINCT ba.bike_id
         FROM app.bicycle_assignments ba
         JOIN app.bicycles b
           ON b.id = ba.bike_id
        WHERE ba.date_to IS NULL
          AND ba.date_from < NOW() - INTERVAL '24 hours'
          AND COALESCE(NULLIF(b.status, ''), 'available') = 'rented'
     ),
     assignment_updates AS (
       UPDATE app.bicycle_assignments ba
          SET status_bike = 'late'
         FROM overdue o
        WHERE ba.bike_id = o.bike_id
          AND ba.date_to IS NULL
          AND COALESCE(NULLIF(ba.status_bike, ''), 'rented') = 'rented'
       RETURNING ba.bike_id
     ),
     bike_updates AS (
       UPDATE app.bicycles b
          SET status = 'late',
              updated_at = NOW()
         FROM overdue o
        WHERE b.id = o.bike_id
          AND COALESCE(NULLIF(b.status, ''), 'available') = 'rented'
       RETURNING b.id
     )
     SELECT COUNT(*)::int AS late_bicycle_rentals
       FROM bike_updates`,
  );

  return Number(rows[0]?.late_bicycle_rentals || 0);
}

async function runDatabaseMaintenance({ env = defaultEnv, logger, metrics = defaultMetrics } = {}) {
  const startedAt = process.hrtime.bigint();

  return withClient(async (client) => {
    await client.query('SET search_path TO app, public');

    const { rows } = await client.query(
      `WITH lock_attempt AS (
         SELECT pg_try_advisory_lock(${DB_MAINTENANCE_LOCK_ID}) AS locked
       ),
       maintenance AS (
         SELECT *
           FROM app.run_database_maintenance($1::interval, $2::interval)
          WHERE (SELECT locked FROM lock_attempt)
       ),
       unlock_attempt AS (
         SELECT pg_advisory_unlock(${DB_MAINTENANCE_LOCK_ID})
          WHERE (SELECT locked FROM lock_attempt)
       )
       SELECT
         COALESCE((SELECT locked FROM lock_attempt), TRUE) AS locked,
         COALESCE((SELECT expired_requests FROM maintenance), 0) AS expired_requests,
         COALESCE((SELECT deleted_sessions FROM maintenance), 0) AS deleted_sessions,
         COALESCE((SELECT deleted_failed_logins FROM maintenance), 0) AS deleted_failed_logins,
         COALESCE((SELECT archived_audit_logs FROM maintenance), 0) AS archived_audit_logs`,
      [`${env.DB_FAILED_LOGINS_RETENTION_DAYS} days`, `${env.DB_AUDIT_ARCHIVE_AFTER_DAYS} days`],
    );

    const summary = rows[0] || {
      locked: true,
      expired_requests: 0,
      deleted_sessions: 0,
      deleted_failed_logins: 0,
      archived_audit_logs: 0,
    };

    const locked = summary.locked !== false;

    if (!locked) {
      metrics?.counter?.('gss_jobs_total', { job: 'db_maintenance', status: 'skipped_lock' });
      logger?.warn?.('db_maintenance_skipped_lock');
      return {
        skipped: true,
        reason: 'lock_not_acquired',
        expired_requests: 0,
        deleted_sessions: 0,
        deleted_failed_logins: 0,
        archived_audit_logs: 0,
      };
    }

    const lateBicycleRentals = await markLateBicycleRentals(client);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    metrics?.counter?.('gss_jobs_total', { job: 'db_maintenance', status: 'ok' });
    metrics?.histogramObserve?.(
      'gss_job_duration_ms',
      { job: 'db_maintenance', status: 'ok' },
      durationMs,
    );

    logger?.info?.('db_maintenance_completed', {
      expiredRequests: Number(summary.expired_requests || 0),
      deletedSessions: Number(summary.deleted_sessions || 0),
      deletedFailedLogins: Number(summary.deleted_failed_logins || 0),
      archivedAuditLogs: Number(summary.archived_audit_logs || 0),
      lateBicycleRentals,
      durationMs,
    });

    return {
      expired_requests: Number(summary.expired_requests || 0),
      deleted_sessions: Number(summary.deleted_sessions || 0),
      deleted_failed_logins: Number(summary.deleted_failed_logins || 0),
      archived_audit_logs: Number(summary.archived_audit_logs || 0),
      late_bicycle_rentals: lateBicycleRentals,
    };
  });
}

module.exports = { runDatabaseMaintenance, DB_MAINTENANCE_LOCK_ID };
