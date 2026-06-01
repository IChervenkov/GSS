const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../helpers/module-mocks');

test('runDatabaseMaintenance forwards retention settings to the migrated maintenance function', async () => {
  const queries = [];
  const metricsCalls = [];
  const logs = [];

  const { runDatabaseMaintenance } = requireFresh(
    'src/infrastructure/maintenance/db-maintenance.ts',
    {
      'src/core/config/env.ts': {
        DB_FAILED_LOGINS_RETENTION_DAYS: 7,
        DB_AUDIT_ARCHIVE_AFTER_DAYS: 180,
      },
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('late_bicycle_rentals')) {
                return { rows: [{ late_bicycle_rentals: 6 }] };
              }
              return {
                rows: [
                  {
                    expired_requests: 2,
                    deleted_sessions: 3,
                    deleted_failed_logins: 4,
                    archived_audit_logs: 5,
                  },
                ],
              };
            },
          }),
      },
      'src/shared/observability/metrics.ts': {
        metrics: {
          counter(name, labels) {
            metricsCalls.push({ type: 'counter', name, labels });
          },
          histogramObserve(name, labels) {
            metricsCalls.push({ type: 'histogram', name, labels });
          },
        },
      },
    },
  );

  const result = await runDatabaseMaintenance({
    logger: {
      info(event, meta) {
        logs.push({ event, meta });
      },
    },
  });

  assert.deepEqual(result, {
    expired_requests: 2,
    deleted_sessions: 3,
    deleted_failed_logins: 4,
    archived_audit_logs: 5,
    late_bicycle_rentals: 6,
  });
  assert.equal(queries[0].sql, 'SET search_path TO app, public');
  assert.match(queries[1].sql, /FROM app\.run_database_maintenance/);
  assert.deepEqual(queries[1].params, ['7 days', '180 days']);
  assert.match(queries[2].sql, /late_bicycle_rentals/);
  assert.match(queries[2].sql, /date_from < NOW\(\) - INTERVAL '24 hours'/);
  assert.equal(
    metricsCalls.some((call) => call.name === 'gss_jobs_total'),
    true,
  );
  assert.equal(logs[0]?.event, 'db_maintenance_completed');
  assert.equal(logs[0]?.meta?.lateBicycleRentals, 6);
});

test('maintenance scheduler skips overlapping runs and can stop cleanly', async () => {
  const metricsCalls = [];
  const warnings = [];
  let releaseRun;
  let runCount = 0;

  const { startMaintenanceScheduler } = requireFresh(
    'src/infrastructure/maintenance/maintenance-scheduler.ts',
    {
      'src/shared/observability/metrics.ts': {
        metrics: {
          counter(name, labels) {
            metricsCalls.push({ name, labels });
          },
        },
      },
    },
  );

  const scheduler = startMaintenanceScheduler({
    intervalMs: 20,
    logger: {
      info() {},
      warn(event) {
        warnings.push(event);
      },
      error() {},
    },
    runJob: async () => {
      runCount += 1;
      await new Promise((resolve) => {
        releaseRun = resolve;
      });
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 75));
  releaseRun();
  await new Promise((resolve) => setTimeout(resolve, 30));
  scheduler.stop();

  assert.equal(runCount >= 1, true);
  assert.equal(
    metricsCalls.some(
      (call) => call.name === 'gss_jobs_total' && call.labels?.status === 'skipped_overlap',
    ),
    true,
  );
  assert.equal(warnings.includes('db_maintenance_scheduler_skipped_overlap'), true);
});
