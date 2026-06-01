const test = require('node:test');
const assert = require('node:assert/strict');

const { invalidateUserSessions, destroySessionAndClearCookie } = require('../../../src/shared/utils/session-utils');
const { metrics } = require('../../../src/shared/observability/metrics');

test('invalidateUserSessions records store success metrics with destroyed session count', async () => {
  const calls = [];
  const originalCounter = metrics.counter;
  metrics.counter = (name, labels, value) => calls.push({ name, labels, value: value ?? 1 });

  try {
    const result = await invalidateUserSessions({
      reason: 'admin_reset',
      userIds: ['user-1'],
      store: {
        all(callback) {
          callback(null, {
            'sess-1': { userId: 'user-1' },
            'sess-2': { pendingUserId: 'user-1' },
            'sess-3': { userId: 'user-2' },
          });
        },
        destroy(_sessionId, callback) {
          callback(null);
        },
      },
    });

    assert.deepEqual(result, { destroyedSessionIds: ['sess-1', 'sess-2'], skipped: false });
    assert.deepEqual(calls, [
      {
        name: 'gss_session_invalidations_total',
        labels: { mode: 'store', outcome: 'success', reason: 'admin_reset' },
        value: 2,
      },
    ]);
  } finally {
    metrics.counter = originalCounter;
  }
});

test('destroySessionAndClearCookie records request invalidation outcome and clears sid cookie', async () => {
  const calls = [];
  const originalCounter = metrics.counter;
  metrics.counter = (name, labels, value) => calls.push({ name, labels, value: value ?? 1 });

  try {
    let cleared = null;
    const req = {
      session: {
        destroy(callback) {
          callback(null);
        },
      },
    };
    const res = {
      clearCookie(name, options) {
        cleared = { name, options };
      },
    };

    await destroySessionAndClearCookie(req, res, { isProd: true }, { reason: 'session_error_policy' });

    assert.deepEqual(cleared, {
      name: 'sid',
      options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
    });
    assert.deepEqual(calls, [
      {
        name: 'gss_session_invalidations_total',
        labels: { mode: 'request', outcome: 'success', reason: 'session_error_policy' },
        value: 1,
      },
    ]);
  } finally {
    metrics.counter = originalCounter;
  }
});
