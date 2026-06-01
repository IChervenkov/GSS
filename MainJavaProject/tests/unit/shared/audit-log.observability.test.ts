const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAuditLog,
  normalizeAuditMeta,
  inferOutcome,
} = require('../../../src/shared/security/audit-log');

test('createAuditLog normalizes event metadata, updates context, and records metrics', async () => {
  const updates = [];
  const persisted = [];
  const logged = [];
  const counters = [];

  const writeAudit = createAuditLog({
    env: { isProd: true },
    logger: {
      child() {
        return this;
      },
      info: (event, meta) => logged.push({ event, meta }),
      error() {
        throw new Error('should not log persistence failure');
      },
    },
    persistAuditLog: async (payload) => {
      persisted.push(payload);
    },
    updateContext: (partial) => updates.push(partial),
    registry: {
      counter: (name, labels) => counters.push({ name, labels }),
    },
  });

  writeAudit('auth.refresh.rotated', {
    reqId: 'req-1',
    actorUserId: 'actor-1',
    targetUserId: 'target-1',
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(updates, [{ securityEventCategory: 'auth.refresh' }]);
  assert.deepEqual(counters, [
    {
      name: 'gss_security_audit_events_total',
      labels: { eventType: 'auth.refresh.rotated', outcome: 'success' },
    },
  ]);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].event, 'auth.refresh.rotated');
  assert.equal(logged[0].meta.outcome, 'success');
  assert.equal(persisted.length, 1);
  assert.deepEqual(persisted[0], {
    event: 'auth.refresh.rotated',
    meta: {
      reqId: 'req-1',
      actorUserId: 'actor-1',
      targetUserId: 'target-1',
      pendingUserId: null,
      ip: '127.0.0.1',
      userAgent: 'node-test',
      method: null,
      path: null,
      eventType: 'auth.refresh.rotated',
      outcome: 'success',
    },
  });
});

test('normalizeAuditMeta and inferOutcome cover denied and explicit outcomes', () => {
  assert.equal(inferOutcome('auth.qr.denied'), 'denied');
  assert.equal(inferOutcome('auth.login.failed', { outcome: 'blocked' }), 'blocked');
  assert.deepEqual(normalizeAuditMeta('auth.qr.denied', { reqId: 'req-2' }), {
    reqId: 'req-2',
    actorUserId: null,
    targetUserId: null,
    pendingUserId: null,
    ip: null,
    userAgent: null,
    method: null,
    path: null,
    eventType: 'auth.qr.denied',
    outcome: 'denied',
  });
});
