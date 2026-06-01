const { metrics } = require('../observability/metrics');
const { getSessionPrincipalId } = require('../session/web-session-state');

const SESSION_COOKIE_NAME = 'sid';

function toOptionalString(value) {
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

function getSessionCookieOptions(env) {
  const secure = env?.SESSION_COOKIE_SECURE;
  return {
    path: toOptionalString(env?.SESSION_COOKIE_PATH) || '/',
    httpOnly: true,
    secure: typeof secure === 'boolean' ? secure : Boolean(env?.isProd),
    sameSite: toOptionalString(env?.SESSION_COOKIE_SAME_SITE) || 'lax',
    ...(toOptionalString(env?.SESSION_COOKIE_DOMAIN)
      ? { domain: toOptionalString(env?.SESSION_COOKIE_DOMAIN) }
      : {}),
  };
}

function touchAbsoluteExpiry(req, env) {
  if (!req?.session || req.session.absoluteExpiresAt) return;
  req.session.absoluteExpiresAt =
    Date.now() + Number(env?.SESSION_ABSOLUTE_TTL_MS || 24 * 60 * 60 * 1000);
}

function isSessionExpired(req) {
  const absoluteExpiresAt = Number(req?.session?.absoluteExpiresAt || 0);
  return Boolean(absoluteExpiresAt && absoluteExpiresAt <= Date.now());
}

function recordSessionInvalidation(labels = {}, value = 1) {
  metrics.counter('gss_session_invalidations_total', labels, value);
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve(false);
    req.session.destroy((err) => (err ? reject(err) : resolve(true)));
  });
}

function listStoredSessions(store) {
  return new Promise((resolve, reject) => {
    if (typeof store?.all !== 'function') {
      resolve(null);
      return;
    }
    store.all((err, sessions) => (err ? reject(err) : resolve(sessions)));
  });
}

function destroyStoredSession(store, sessionId) {
  return new Promise((resolve, reject) => {
    if (!sessionId || typeof store?.destroy !== 'function') {
      resolve(false);
      return;
    }
    store.destroy(sessionId, (err) => (err ? reject(err) : resolve(true)));
  });
}

function normalizeStoredSessions(snapshot) {
  if (Array.isArray(snapshot)) {
    return snapshot
      .map((session) => ({
        sessionId: session?.id ? String(session.id) : null,
        session,
      }))
      .filter((entry) => entry.sessionId && entry.session);
  }

  if (!snapshot || typeof snapshot !== 'object') return [];

  return Object.entries(snapshot)
    .map(([sessionId, session]) => ({
      sessionId: sessionId ? String(sessionId) : null,
      session,
    }))
    .filter((entry) => entry.sessionId && entry.session);
}

async function invalidateUserSessions({ store, userIds = [], reason = 'bulk_invalidate' } = {}) {
  const targetUserIds = [...new Set(userIds.map((userId) => String(userId || '')).filter(Boolean))];
  if (targetUserIds.length === 0) {
    return { destroyedSessionIds: [], skipped: true };
  }

  if (typeof store?.all !== 'function' || typeof store?.destroy !== 'function') {
    recordSessionInvalidation({ mode: 'store', outcome: 'skipped', reason });
    return { destroyedSessionIds: [], skipped: true };
  }

  const snapshot = await listStoredSessions(store);
  const sessions = normalizeStoredSessions(snapshot);
  const destroyedSessionIds = [
    ...new Set(
      sessions
        .filter((entry) => targetUserIds.includes(getSessionPrincipalId(entry.session)))
        .map((entry) => entry.sessionId),
    ),
  ];

  await Promise.all(destroyedSessionIds.map((sessionId) => destroyStoredSession(store, sessionId)));
  if (destroyedSessionIds.length > 0) {
    recordSessionInvalidation({ mode: 'store', outcome: 'success', reason }, destroyedSessionIds.length);
  }

  return {
    destroyedSessionIds,
    skipped: false,
  };
}

async function destroySessionAndClearCookie(req, res, env, meta = {}) {
  const reason = meta.reason || 'request_destroy';
  const hadSession = Boolean(req?.session);
  try {
    const destroyed = await destroySession(req);
    if (res?.clearCookie) {
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(env));
    }
    recordSessionInvalidation({ mode: 'request', outcome: destroyed || hadSession ? 'success' : 'noop', reason });
  } catch (error) {
    recordSessionInvalidation({ mode: 'request', outcome: 'error', reason });
    throw error;
  }
}

function saveSession(req) {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}

function regenerateSession(req) {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
}

module.exports = {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  destroySession,
  destroySessionAndClearCookie,
  invalidateUserSessions,
  touchAbsoluteExpiry,
  isSessionExpired,
  saveSession,
  regenerateSession,
};
