// @ts-nocheck
const session = require('express-session');
const {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  touchAbsoluteExpiry,
  isSessionExpired,
  destroySession,
} = require('../../shared/utils/session-utils');

let RedisStore;
try {
  RedisStore = require('connect-redis').default;
} catch {
  RedisStore = null;
}

function isRedisMandatory(env) {
  return Boolean(env?.REDIS_REQUIRED || env?.isProdLike);
}

async function initRedis({ env, getRedisClient }) {
  if (!RedisStore) {
    if (isRedisMandatory(env)) {
      throw new Error(
        'Redis session store is required in this environment. Install connect-redis.',
      );
    }
    return null;
  }

  const client = await getRedisClient?.(env);
  if (!client) {
    if (isRedisMandatory(env)) {
      throw new Error('Redis session store could not be initialized.');
    }
    return null;
  }

  return client;
}

async function createSessionMiddleware({ env, logger, getRedisClient } = {}) {
  const secrets = [env.SESSION_SECRET, ...env.SESSION_SECRET_PREVIOUS].filter(Boolean);
  if (secrets.length === 0) throw new Error('SESSION_SECRET is required');

  const sessionOptions = {
    name: SESSION_COOKIE_NAME,
    secret: secrets,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: Boolean(env.TRUST_PROXY),
    cookie: {
      ...getSessionCookieOptions(env),
      maxAge: env.SESSION_TTL_MS,
    },
  };

  const sessionLogger = logger?.child?.({ component: 'session' }) || logger;
  const client = await initRedis({ env, getRedisClient });
  if (client) {
    sessionOptions.store = new RedisStore({
      client,
      prefix: env.SESSION_REDIS_PREFIX,
      ttl: Math.ceil(env.SESSION_TTL_MS / 1000),
      disableTouch: false,
    });
  } else {
    sessionLogger?.warn?.('session_store_memory_fallback', { nodeEnv: env.NODE_ENV });
  }

  const backendMode = client ? 'redis' : 'memory';
  sessionLogger?.info?.('session_store_mode_selected', {
    mode: backendMode,
    required: isRedisMandatory(env),
  });

  const middleware = session(sessionOptions);

  const sessionMiddleware = async (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) return next(err);
      try {
        if (!req.session) return next();
        if (isSessionExpired(req)) {
          await destroySession(req);
          res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(env));
          return next();
        }
        touchAbsoluteExpiry(req, env);
        return next();
      } catch (sessionErr) {
        return next(sessionErr);
      }
    });
  };

  sessionMiddleware.backendMode = backendMode;
  return sessionMiddleware;
}

module.exports = { createSessionMiddleware };
