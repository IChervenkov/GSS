// @ts-nocheck
function createSocketAdapterAttacher({
  env,
  logger,
  metrics,
  getRedisClient,
  isRedisConfigured,
} = {}) {
  const adapterLogger = logger?.child?.({ component: 'socket-adapter' }) || logger;
  let adapterFactoryPromise = null;

  async function createRedisAdapterFactory() {
    if (adapterFactoryPromise) return adapterFactoryPromise;

    adapterFactoryPromise = (async () => {
      let createAdapter;
      try {
        ({ createAdapter } = require('@socket.io/redis-adapter'));
      } catch (error) {
        if (env?.REDIS_REQUIRED || env?.isProdLike || isRedisConfigured?.(env)) {
          throw new Error(
            'Redis Socket.IO adapter is required but @socket.io/redis-adapter is not installed.',
          );
        }
        return null;
      }

      const pubClient = await getRedisClient?.(env);
      if (!pubClient) {
        if (env?.REDIS_REQUIRED || env?.isProdLike || isRedisConfigured?.(env)) {
          throw new Error('Redis Socket.IO adapter could not initialize because Redis is unavailable.');
        }
        return null;
      }

      const subClient = pubClient.duplicate();
      await subClient.connect();
      return { createAdapter, pubClient, subClient };
    })().catch((error) => {
      adapterFactoryPromise = null;
      throw error;
    });

    return adapterFactoryPromise;
  }

  return async function attachSocketAdapter(io) {
    const factory = await createRedisAdapterFactory();
    if (!factory) {
      metrics?.gaugeSet?.('gss_socket_adapter_mode', { mode: 'memory' }, 1);
      metrics?.gaugeSet?.('gss_socket_adapter_mode', { mode: 'redis' }, 0);
      adapterLogger?.warn?.('socket_adapter_memory_mode', { reason: 'redis_not_available' });
      return { mode: 'memory' };
    }

    io.adapter(factory.createAdapter(factory.pubClient, factory.subClient));
    metrics?.gaugeSet?.('gss_socket_adapter_mode', { mode: 'redis' }, 1);
    metrics?.gaugeSet?.('gss_socket_adapter_mode', { mode: 'memory' }, 0);
    adapterLogger?.info?.('socket_adapter_redis_enabled', {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });
    return { mode: 'redis' };
  };
}

module.exports = { createSocketAdapterAttacher };
