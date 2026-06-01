const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');

function createMemoryStore() {
  const buckets = new Map();

  function prune(key, now) {
    const entry = buckets.get(key);
    if (!entry) return null;
    entry.hits = entry.hits.filter((ts) => ts > now - entry.windowMs);
    if (entry.hits.length === 0 && !entry.blockedUntil) {
      buckets.delete(key);
      return null;
    }
    return entry;
  }

  return {
    async hit(key, windowMs, now) {
      let entry = buckets.get(key);
      if (!entry) {
        entry = { hits: [], blockedUntil: 0, windowMs };
        buckets.set(key, entry);
      }
      entry.windowMs = windowMs;
      prune(key, now);
      entry.hits.push(now);
      return entry;
    },
    async get(key, windowMs, now) {
      let entry = buckets.get(key);
      if (!entry) return { hits: [], blockedUntil: 0, windowMs };
      entry.windowMs = windowMs;
      prune(key, now);
      entry = buckets.get(key) || { hits: [], blockedUntil: 0, windowMs };
      return entry;
    },
    async block(key, until, windowMs) {
      const entry = buckets.get(key) || { hits: [], blockedUntil: 0, windowMs };
      entry.windowMs = windowMs;
      entry.blockedUntil = Math.max(entry.blockedUntil || 0, until);
      buckets.set(key, entry);
      return entry;
    },
    async reset(key) {
      buckets.delete(key);
    },
  };
}

function createRedisStore({ getRedisClient, prefix = 'security:rate-limit:' } = {}) {
  const countKey = (key) => `${prefix}count:${key}`;
  const blockKey = (key) => `${prefix}block:${key}`;

  return {
    async hit(key, windowMs) {
      const client = await getRedisClient?.();
      if (!client) return { hits: [] };

      const current = await client.incr(countKey(key));
      await client.pExpire(countKey(key), windowMs);
      return { hits: new Array(Number(current)).fill(0), blockedUntil: 0, windowMs };
    },
    async get(key, windowMs, now) {
      const client = await getRedisClient?.();
      if (!client) return { hits: [], blockedUntil: 0, windowMs };

      const [countRaw, blockedRaw] = await client.mGet([countKey(key), blockKey(key)]);
      const blockedUntil = blockedRaw ? Number(blockedRaw) : 0;
      const count = Number(countRaw || 0);
      const effectiveBlockedUntil = blockedUntil > now ? blockedUntil : 0;
      return {
        hits: new Array(count).fill(0),
        blockedUntil: effectiveBlockedUntil,
        windowMs,
      };
    },
    async block(key, until, windowMs, now) {
      const client = await getRedisClient?.();
      if (!client) return { hits: [], blockedUntil: until, windowMs };

      const ttlMs = Math.max(1, until - (now || Date.now()));
      await client.set(blockKey(key), String(until), { PX: ttlMs });
      return { hits: [], blockedUntil: until, windowMs };
    },
    async reset(key) {
      const client = await getRedisClient?.();
      if (!client) return;
      await client.del([countKey(key), blockKey(key)]);
    },
  };
}

function createSharedRateLimitStore({
  env,
  getRedisClient,
  isRedisConfigured,
  isRedisMandatory,
} = {}) {
  if (isRedisConfigured?.(env) || isRedisMandatory?.(env)) {
    const store = createRedisStore({
      getRedisClient: () => getRedisClient?.(env),
    });
    store.backendMode = 'redis';
    return store;
  }

  const store = createMemoryStore();
  store.backendMode = 'memory';
  return store;
}

const defaultStore = createMemoryStore();

function getClientIp(req) {
  return String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function defaultKey(req) {
  return getClientIp(req);
}

function createRateLimitMiddleware({
  key = defaultKey,
  windowMs = 60 * 1000,
  max = 10,
  blockMs = windowMs,
  code = ERROR_CODES.RATE_LIMITED,
  message = 'Too many requests. Please try again later.',
  store = defaultStore,
} = {}) {
  return async (req, _res, next) => {
    try {
      const now = Date.now();
      const rateKey = String(key(req));
      const state = await store.get(rateKey, windowMs, now);

      if (state.blockedUntil && state.blockedUntil > now) {
        return next(
          new AppError({
            status: 429,
            code,
            message,
            details: [{ retryAfterMs: state.blockedUntil - now }],
          }),
        );
      }

      const updated = await store.hit(rateKey, windowMs, now);
      if (updated.hits.length > max) {
        const blockedUntil = now + blockMs;
        await store.block(rateKey, blockedUntil, windowMs, now);
        return next(
          new AppError({ status: 429, code, message, details: [{ retryAfterMs: blockMs }] }),
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function createSlowDownMiddleware({
  key = defaultKey,
  windowMs = 5 * 60 * 1000,
  delayAfter = 3,
  delayMs = 300,
  maxDelayMs = 2500,
  store = defaultStore,
} = {}) {
  return async (req, _res, next) => {
    try {
      const now = Date.now();
      const rateKey = String(key(req));
      const state = await store.get(rateKey, windowMs, now);
      const over = Math.max(0, state.hits.length - delayAfter);
      const waitMs = Math.min(over * delayMs, maxDelayMs);
      if (waitMs <= 0) return next();
      setTimeout(next, waitMs);
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createMemoryStore,
  createRedisStore,
  createSharedRateLimitStore,
  createRateLimitMiddleware,
  createSlowDownMiddleware,
  getClientIp,
};
