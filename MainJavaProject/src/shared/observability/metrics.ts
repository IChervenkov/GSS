// @ts-nocheck
const os = require('os');
const env = require('../../core/config/env');

function toSnakeCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[.\-\s]+/g, '_')
    .toLowerCase();
}

function normalizeMetricLabelKey(key) {
  const normalized = toSnakeCase(key);
  const aliases = {
    event_type: 'event_name',
    event_name: 'event_name',
    request_id: 'request_id',
    req_id: 'request_id',
    user_id: 'user_id',
    actor_user_id: 'actor_user_id',
    target_user_id: 'target_user_id',
    pending_user_id: 'pending_user_id',
    device_id: 'device_id',
    room_kind: 'room_kind',
  };
  return aliases[normalized] || normalized;
}

function normalizeMetricLabels(labels = {}) {
  return Object.keys(labels || {})
    .sort()
    .reduce((acc, key) => {
      const normalizedKey = normalizeMetricLabelKey(key);
      acc[normalizedKey] = labels[key];
      return acc;
    }, {});
}

class MetricsRegistry {
  constructor() {
    this.startedAt = Date.now();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.descriptions = new Map();
  }

  static labelsKey(labels = {}) {
    return JSON.stringify(normalizeMetricLabels(labels));
  }

  describe(name, help) {
    if (!help) return;
    this.descriptions.set(name, String(help));
  }

  counter(name, labels = {}, value = 1) {
    const metric = this._getSeries(this.counters, name);
    const key = MetricsRegistry.labelsKey(labels);
    metric.set(key, (metric.get(key) || 0) + value);
  }

  gaugeSet(name, labels = {}, value = 0) {
    const metric = this._getSeries(this.gauges, name);
    const key = MetricsRegistry.labelsKey(labels);
    metric.set(key, value);
  }

  gaugeInc(name, labels = {}, value = 1) {
    const metric = this._getSeries(this.gauges, name);
    const key = MetricsRegistry.labelsKey(labels);
    metric.set(key, (metric.get(key) || 0) + value);
  }

  gaugeDec(name, labels = {}, value = 1) {
    this.gaugeInc(name, labels, -value);
  }

  histogramObserve(name, labels = {}, value = 0) {
    const metric = this._getSeries(this.histograms, name);
    const key = MetricsRegistry.labelsKey(labels);
    const entry = metric.get(key) || { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: 0 };
    entry.count += 1;
    entry.sum += value;
    entry.min = Math.min(entry.min, value);
    entry.max = Math.max(entry.max, value);
    metric.set(key, entry);
  }

  _getSeries(store, name) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  }

  snapshot() {
    return {
      process: {
        uptime_seconds: Math.round(process.uptime()),
        rss_bytes: process.memoryUsage().rss,
        heap_used_bytes: process.memoryUsage().heapUsed,
        event_loop_lag_hint_ms: undefined,
        hostname: os.hostname(),
      },
      counters: this._normalizeNumeric(this.counters),
      gauges: this._normalizeNumeric(this.gauges),
      histograms: this._normalizeHistogram(this.histograms),
      generated_at: new Date().toISOString(),
      started_at: new Date(this.startedAt).toISOString(),
    };
  }

  toPrometheusText() {
    const parts = [];
    const pushLabels = (labels) => {
      const entries = Object.entries(labels || {});
      if (entries.length === 0) return '';
      return `{${entries.map(([k, v]) => `${k}="${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
    };
    for (const [name, series] of this.counters.entries()) {
      const help = this.descriptions.get(name);
      if (help) parts.push(`# HELP ${name} ${help}`);
      parts.push(`# TYPE ${name} counter`);
      for (const [key, value] of series.entries())
        parts.push(`${name}${pushLabels(JSON.parse(key))} ${value}`);
    }
    for (const [name, series] of this.gauges.entries()) {
      const help = this.descriptions.get(name);
      if (help) parts.push(`# HELP ${name} ${help}`);
      parts.push(`# TYPE ${name} gauge`);
      for (const [key, value] of series.entries())
        parts.push(`${name}${pushLabels(JSON.parse(key))} ${value}`);
    }
    for (const [name, series] of this.histograms.entries()) {
      const help = this.descriptions.get(name);
      if (help) {
        parts.push(`# HELP ${name}_count ${help} sample count`);
        parts.push(`# HELP ${name}_sum ${help} sample sum`);
        parts.push(`# HELP ${name}_min ${help} minimum observed value`);
        parts.push(`# HELP ${name}_max ${help} maximum observed value`);
      }
      parts.push(`# TYPE ${name}_count counter`);
      parts.push(`# TYPE ${name}_sum counter`);
      parts.push(`# TYPE ${name}_min gauge`);
      parts.push(`# TYPE ${name}_max gauge`);
      for (const [key, value] of series.entries()) {
        const labels = JSON.parse(key);
        parts.push(`${name}_count${pushLabels(labels)} ${value.count}`);
        parts.push(`${name}_sum${pushLabels(labels)} ${value.sum}`);
        parts.push(
          `${name}_min${pushLabels(labels)} ${Number.isFinite(value.min) ? value.min : 0}`,
        );
        parts.push(`${name}_max${pushLabels(labels)} ${value.max}`);
      }
    }
    return `${parts.join('\n')}\n`;
  }

  _normalizeNumeric(store) {
    return Object.fromEntries(
      [...store.entries()].map(([name, series]) => [
        name,
        [...series.entries()].map(([key, value]) => ({ labels: JSON.parse(key), value })),
      ]),
    );
  }

  _normalizeHistogram(store) {
    return Object.fromEntries(
      [...store.entries()].map(([name, series]) => [
        name,
        [...series.entries()].map(([key, value]) => ({
          labels: JSON.parse(key),
          ...value,
          avg: value.count > 0 ? value.sum / value.count : 0,
        })),
      ]),
    );
  }
}

const metrics = new MetricsRegistry();

const defaultMetricDescriptions = {
  gss_build_info: 'Static build information for the running service instance.',
  gss_process_up: 'Whether the service process is running.',
  gss_http_requests_total: 'Total completed HTTP requests.',
  gss_http_request_duration_ms: 'Observed HTTP request duration in milliseconds.',
  gss_http_request_context_total: 'Total completed HTTP requests with normalized request context labels.',
  gss_http_error_total: 'Total HTTP errors by route and application code.',
  gss_auth_failures_total: 'Total authentication and authorization failures.',
  gss_auth_login_attempts_total: 'Total login attempts by outcome.',
  gss_auth_2fa_attempts_total: 'Total 2FA challenge and verification attempts by outcome.',
  gss_auth_qr_requests_total: 'Total verification-request lifecycle events by action and outcome.',
  gss_auth_refresh_total: 'Total refresh token attempts by outcome.',
  gss_session_invalidations_total: 'Total invalidated sessions by mode and outcome.',
  gss_security_audit_events_total: 'Total security audit events by event name and outcome.',
  gss_db_queries_total: 'Total database queries by repository, statement, and status.',
  gss_db_query_duration_ms: 'Observed database query duration in milliseconds.',
  gss_db_pool_total_clients: 'Current total PostgreSQL pool clients.',
  gss_db_pool_idle_clients: 'Current idle PostgreSQL pool clients.',
  gss_db_pool_waiting_clients: 'Current waiting PostgreSQL pool clients.',
  gss_db_pool_errors_total: 'Total PostgreSQL pool-level errors.',
  gss_dependency_readiness: 'Dependency readiness status where 1 is ready and 0 is not ready.',
  gss_redis_errors_total: 'Total Redis client errors.',
  gss_redis_reconnects_total: 'Total Redis reconnect attempts.',
  gss_socket_connections_total: 'Total accepted WebSocket connections.',
  gss_socket_auth_failures_total: 'Total WebSocket authentication failures.',
  gss_socket_disconnects_total: 'Total WebSocket disconnects.',
  gss_socket_active_connections: 'Current active WebSocket connections.',
  gss_socket_subscription_attempts_total: 'Total socket subscription or unsubscription attempts.',
  gss_socket_subscription_rejections_total: 'Total rejected socket subscription attempts.',
  gss_socket_room_subscriptions_total: 'Total successful room subscription changes.',
  gss_socket_room_joins_total: 'Total socket room joins by room kind and source.',
  gss_socket_room_leaves_total: 'Total socket room leaves by room kind and source.',
  gss_socket_principal_reevaluations_total: 'Total socket principal reevaluations by reason and outcome.',
  gss_socket_forced_disconnects_total: 'Total forced WebSocket disconnects by reason.',
  gss_socket_reconnect_storms_total: 'Total detected reconnect storm events.',
  gss_socket_emit_validation_failures_total: 'Total server-side socket emit validation failures.',
  gss_socket_adapter_mode: 'Socket adapter mode where 1 indicates the active adapter mode.',
  gss_jobs_total: 'Total maintenance jobs executed.',
  gss_job_duration_ms: 'Observed maintenance job duration in milliseconds.',
};

for (const [metricName, description] of Object.entries(defaultMetricDescriptions)) {
  metrics.describe(metricName, description);
}
metrics.gaugeSet(
  'gss_process_up',
  {
    service: env.APP_NAME,
    version: env.APP_VERSION,
    instance: env.OBSERVABILITY_INSTANCE || os.hostname(),
  },
  1,
);
metrics.gaugeSet(
  'gss_build_info',
  {
    service: env.APP_NAME,
    version: env.APP_VERSION,
    build_sha: env.APP_BUILD_SHA || 'unknown',
    build_time: env.APP_BUILD_TIME || 'unknown',
    environment: env.NODE_ENV,
    instance: env.OBSERVABILITY_INSTANCE || os.hostname(),
  },
  1,
);

module.exports = { metrics };
