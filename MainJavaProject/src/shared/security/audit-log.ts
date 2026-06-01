const { updateRequestContext } = require('../observability/request-context');
const { metrics } = require('../observability/metrics');
const { getClientIp } = require('../http/rate-limit');

function inferOutcome(event, meta = {}) {
  if (meta.outcome) return String(meta.outcome);
  const normalized = String(event || '').toLowerCase();
  if (
    normalized.endsWith('.success') ||
    normalized.endsWith('.succeeded') ||
    normalized.endsWith('.rotated') ||
    normalized.endsWith('.resolved') ||
    normalized.endsWith('.revealed') ||
    normalized.endsWith('.requested') ||
    normalized.endsWith('.issued') ||
    normalized.endsWith('.verified') ||
    normalized.endsWith('.created') ||
    normalized.endsWith('.updated') ||
    normalized.endsWith('.imported') ||
    normalized.endsWith('.completed')
  ) {
    return 'success';
  }
  if (normalized.endsWith('.failed')) return 'failure';
  if (normalized.endsWith('.blocked')) return 'blocked';
  if (normalized.endsWith('.denied') || normalized.endsWith('.rejected')) return 'denied';
  if (normalized.endsWith('.locked')) return 'locked';
  return 'info';
}

function normalizeAuditMeta(event, meta = {}) {
  const eventType = meta.eventType || meta.eventName || String(event || '');
  const reqId = meta.reqId || meta.requestId || null;
  const actorUserId = meta.actorUserId || meta.actorId || null;
  const targetUserId = meta.targetUserId || meta.targetId || null;
  const pendingUserId = meta.pendingUserId || meta.pendingId || null;
  const method = meta.method || meta.httpMethod || null;
  const path = meta.path || meta.routePath || null;

  return {
    reqId,
    actorUserId,
    targetUserId,
    pendingUserId,
    ip: meta.ip || null,
    userAgent: meta.userAgent || null,
    method,
    path,
    eventType,
    outcome: inferOutcome(eventType, meta),
  };
}

function createAuditLog({
  env,
  logger,
  persistAuditLog,
  updateContext = updateRequestContext,
  registry = metrics,
} = {}) {
  const writeAuditLog =
    persistAuditLog ||
    ((payload) => {
      const { insertAuditLog } = require('./audit.repository');
      return insertAuditLog(payload);
    });
  const auditLogger = logger?.child?.({ channel: 'security_audit' }) || logger;

  return (event, meta = {}) => {
    const normalizedMeta = normalizeAuditMeta(event, meta);
    updateContext?.({
      securityEventCategory: String(event || '').split('.').slice(0, 2).join('.') || 'security',
    });
    registry?.counter?.('gss_security_audit_events_total', {
      eventType: normalizedMeta.eventType,
      outcome: normalizedMeta.outcome,
    });
    auditLogger?.info?.(normalizedMeta.eventType || event, normalizedMeta);
    void writeAuditLog({ event, meta: normalizedMeta }).catch((error) => {
      auditLogger?.error?.('security_audit_persist_failed', {
        event,
        eventType: normalizedMeta.eventType,
        outcome: normalizedMeta.outcome,
        errorMessage: error?.message,
        stack: env?.isProd ? undefined : error?.stack,
      });
    });
  };
}

function buildRequestMeta(req, extra = {}) {
  const actorUserId = req?.user?.id || req?.session?.userId;
  const requestId =
    extra?.requestId ||
    req?.body?.requestMeta?.requestId ||
    req?.body?.requestId ||
    req?.query?.requestId ||
    req?.headers?.['x-request-id'] ||
    req?.reqId;
  return {
    reqId: requestId,
    requestId,
    ip: req ? getClientIp(req) : undefined,
    actorUserId,
    targetUserId: extra?.targetId || extra?.targetUserId,
    pendingUserId: req?.session?.pendingUserId,
    userAgent: req?.headers?.['user-agent'],
    method: req?.method,
    path: req?.originalUrl || req?.url,
    eventType: extra?.eventName || extra?.eventType,
    outcome: extra?.outcome,
    ...extra,
  };
}

module.exports = { createAuditLog, buildRequestMeta, normalizeAuditMeta, inferOutcome };
