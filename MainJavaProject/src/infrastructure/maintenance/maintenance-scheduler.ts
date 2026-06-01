const { metrics: defaultMetrics } = require('../../shared/observability/metrics');

function startMaintenanceScheduler({
  intervalMs,
  initialDelayMs = intervalMs,
  logger,
  metrics = defaultMetrics,
  runJob,
}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    logger?.warn?.('db_maintenance_scheduler_disabled', { intervalMs });
    return { stop() {} };
  }

  let running = false;
  let stopped = false;
  let initialTimer = null;
  let intervalTimer = null;

  const execute = async () => {
    if (running) {
      metrics?.counter?.('gss_jobs_total', { job: 'db_maintenance', status: 'skipped_overlap' });
      logger?.warn?.('db_maintenance_scheduler_skipped_overlap');
      return;
    }

    running = true;
    try {
      await runJob();
    } catch (error) {
      metrics?.counter?.('gss_jobs_total', { job: 'db_maintenance', status: 'error' });
      logger?.error?.('db_maintenance_scheduler_failed', {
        errorMessage: error?.message,
        stack: error?.stack,
      });
    } finally {
      running = false;
    }
  };

  const startRecurring = () => {
    if (stopped) return;
    intervalTimer = setInterval(() => {
      void execute();
    }, intervalMs);
    intervalTimer.unref?.();
    void execute();
  };

  const effectiveInitialDelay = Number.isFinite(initialDelayMs) && initialDelayMs >= 0
    ? initialDelayMs
    : intervalMs;

  initialTimer = setTimeout(startRecurring, effectiveInitialDelay);
  initialTimer.unref?.();

  logger?.info?.('db_maintenance_scheduler_started', { intervalMs, initialDelayMs: effectiveInitialDelay });

  return {
    stop() {
      stopped = true;
      if (initialTimer) clearTimeout(initialTimer);
      if (intervalTimer) clearInterval(intervalTimer);
      logger?.info?.('db_maintenance_scheduler_stopped');
    },
  };
}

module.exports = { startMaintenanceScheduler };
