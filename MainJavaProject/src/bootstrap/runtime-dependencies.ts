const { createSessionMiddleware } = require('../core/config/session');
const { createLogger, requestLogger } = require('../infrastructure/logging/logger');
const { pool } = require('../infrastructure/db/pool');
const { runDatabaseMaintenance } = require('../infrastructure/maintenance/db-maintenance');
const { createSocketAdapterAttacher } = require('../infrastructure/realtime/socket-adapter');
const { createSocketSessionValidator } = require('../infrastructure/realtime/socket-auth');
const {
  getRedisClient,
  getRedisState,
  isRedisConfigured,
  isRedisMandatory,
} = require('../infrastructure/redis/client');
const { createUploadMiddleware } = require('../infrastructure/upload/multer');
const { createErrorHandler } = require('../shared/http/error-handler');
const { createSharedRateLimitStore } = require('../shared/http/rate-limit');
const { metrics } = require('../shared/observability/metrics');
const { withRequestContext } = require('../shared/observability/request-context');
const { createHealthMonitor } = require('../shared/observability/health');
const { createAuditLog } = require('../shared/security/audit-log');
const { createSocketRuntime } = require('./socket');
const {
  createAuthEventBus,
} = require('../modules/web/auth/infrastructure/realtime/auth.event-bus');
const {
  createMainEventBus,
} = require('../modules/web/main-page/infrastructure/realtime/main-page.event-bus');
const {
  createBicyclesEventBus,
} = require('../modules/web/bicycles/infrastructure/realtime/bicycles.event-bus');
const {
  createAssetsEventBus,
} = require('../modules/web/assets/infrastructure/realtime/assets.event-bus');
const {
  createLaundryEventBus,
} = require('../modules/web/laundry/infrastructure/realtime/laundry.event-bus');
const {
  createAccommodationEventBus,
} = require('../modules/web/accommodation/infrastructure/realtime/accommodation.event-bus');
const {
  createUserSessionInvalidator,
} = require('../modules/web/main-page/infrastructure/session/user-session.invalidator');

const apiAuthRepository = require('../modules/api/auth/infrastructure/persistence/auth.repository');
const authTokens = require('../modules/api/auth/infrastructure/security/auth.tokens');
const accommodationRepository = require('../modules/web/accommodation/infrastructure/repositories/accommodation.repository');
const assetsRepository = require('../modules/web/assets/infrastructure/repositories/assets.repository');
const bicyclesRepository = require('../modules/web/bicycles/infrastructure/repositories/bicycles.repository');
const authUserRequestRepository = require('../modules/web/auth/infrastructure/repositories/user-request.repository');
const authPasswordChangeRepository = require('../modules/web/auth/infrastructure/repositories/password-change.repository');
const authUserRepository = require('../modules/web/auth/infrastructure/repositories/user-auth.repository');
const laundryRepository = require('../modules/web/laundry/infrastructure/repositories/laundry.repository');
const mainCampRepository = require('../modules/web/main-page/infrastructure/repositories/camp.repository');
const mainRepository = require('../modules/web/main-page/infrastructure/repositories/main.repository');
const mainPermissionRepository = require('../modules/web/main-page/infrastructure/repositories/permission.repository');
const mainUserRepository = require('../modules/web/main-page/infrastructure/repositories/user.repository');

function wrapRepositoryFunctions(namespace, value) {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (typeof entry === 'function') {
        return [
          key,
          (...args) => withRequestContext({ repository: `${namespace}.${key}` }, () => entry(...args)),
        ];
      }
      if (entry && typeof entry === 'object') {
        return [key, wrapRepositoryFunctions(`${namespace}.${key}`, entry)];
      }
      return [key, entry];
    }),
  );
}


function createRuntimeDependencies(env) {
  const logger = createLogger({ level: env.LOG_LEVEL, service: env.APP_NAME });
  const auditLog = createAuditLog({ env, logger });
  const requestLoggerMiddleware = requestLogger({ logger, metrics });
  const errorHandler = createErrorHandler({ env, logger, metrics, auditLog });
  const rateLimitStore = createSharedRateLimitStore({
    env,
    getRedisClient,
    isRedisConfigured,
    isRedisMandatory,
  });
  const upload = createUploadMiddleware({ env });
  const health = createHealthMonitor({
    env,
    metrics,
    pool,
    getRedisClient,
    isRedisConfigured,
    isRedisMandatory,
  });
  const attachSocketAdapter = createSocketAdapterAttacher({
    env,
    logger,
    metrics,
    getRedisClient,
    isRedisConfigured,
  });
  const validateSocketSession = createSocketSessionValidator({
    env,
    logger,
    repository: wrapRepositoryFunctions('api.auth', apiAuthRepository),
    metrics,
  });
  const socketRuntime = createSocketRuntime({
    env,
    logger,
    metrics,
    auditLog,
    attachSocketAdapter,
    validateSocketSession,
    permissionRepository: wrapRepositoryFunctions('web.main.permissions', mainPermissionRepository),
    tokenStateRepository: wrapRepositoryFunctions('api.auth', apiAuthRepository),
  });

  async function initializeRedisInfrastructure() {
    const required = isRedisMandatory(env);
    const configured = isRedisConfigured(env);

    if (!required && !configured) {
      logger.info('redis_dependency_mode', {
        required,
        configured,
        connected: false,
        mode: 'disabled',
      });
      return { required, configured, connected: false, mode: 'disabled' };
    }

    const client = await getRedisClient(env);
    const pong = await client?.ping?.();
    const connected = pong === 'PONG';
    logger.info('redis_dependency_mode', {
      required,
      configured,
      connected,
      mode: 'redis',
      response: pong,
    });
    return { required, configured, connected, mode: 'redis' };
  }

  return {
    env,
    logger,
    metrics,
    errorHandler,
    requestLoggerMiddleware,
    rateLimitStore,
    upload,
    socketRuntime,
    pool,
    health,
    getRedisState,
    initializeRedisInfrastructure,
    auditLog,
    async createSessionMiddleware() {
      return createSessionMiddleware({ env, logger, getRedisClient });
    },
    async runDatabaseMaintenance() {
      return runDatabaseMaintenance({ env, logger, metrics });
    },
    modules: {
      api: {
        auth: {
          env,
          auditLog,
          repositories: {
            auth: wrapRepositoryFunctions('api.auth', apiAuthRepository),
          },
          tokens: authTokens,
          metrics,
        },
        bikeApp: {
          env,
          auditLog,
          eventBus: createBicyclesEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          repositories: {
            bicycles: wrapRepositoryFunctions('api.bikeApp.bicycles', bicyclesRepository),
            main: wrapRepositoryFunctions('api.bikeApp.main', mainRepository),
          },
        },
        inventoryApp: {
          env,
          auditLog,
          eventBus: createAssetsEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          repositories: {
            assets: wrapRepositoryFunctions('api.inventoryApp.assets', assetsRepository),
            main: wrapRepositoryFunctions('api.inventoryApp.main', mainRepository),
          },
        },
        laundryApp: {
          env,
          auditLog,
          eventBus: createLaundryEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          repositories: {
            laundry: wrapRepositoryFunctions('api.laundryApp.laundry', laundryRepository),
            main: wrapRepositoryFunctions('api.laundryApp.main', mainRepository),
          },
        },
      },
      web: {
        accommodation: {
          eventBus: createAccommodationEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          upload,
          repositories: {
            accommodation: wrapRepositoryFunctions('web.accommodation', accommodationRepository),
          },
        },
        assets: {
          env,
          auditLog,
          eventBus: createAssetsEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          upload,
          repositories: {
            assets: wrapRepositoryFunctions('web.assets', assetsRepository),
          },
        },
        auth: {
          env,
          auditLog,
          eventBus: createAuthEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          rateLimitStore,
          metrics,
          repositories: {
            userRequests: wrapRepositoryFunctions('web.auth.userRequests', authUserRequestRepository),
            passwordChanges: wrapRepositoryFunctions('web.auth.passwordChanges', authPasswordChangeRepository),
            users: wrapRepositoryFunctions('web.auth.users', authUserRepository),
          },
        },
        base: {
          env,
          metrics,
          pool,
          getRedisState,
          health,
        },
        bicycles: {
          env,
          auditLog,
          eventBus: createBicyclesEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          upload,
          repositories: {
            bicycles: wrapRepositoryFunctions('web.bicycles', bicyclesRepository),
          },
        },
        laundry: {
          env,
          auditLog,
          eventBus: createLaundryEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
          upload,
          repositories: {
            laundry: wrapRepositoryFunctions('web.laundry', laundryRepository),
          },
        },
        main: {
          env,
          auditLog,
          eventBus: {
            ...createMainEventBus({ emitRoomEvent: socketRuntime.emitRoomEvent }),
            reevaluateUserSockets: socketRuntime.reevaluateUserSockets,
          },
          sessionInvalidator: createUserSessionInvalidator({
            disconnectUserSockets: socketRuntime.disconnectUserSockets,
          }),
          upload,
          metrics,
          repositories: {
            camps: wrapRepositoryFunctions('web.main.camps', mainCampRepository),
            main: wrapRepositoryFunctions('web.main.main', mainRepository),
            permissions: wrapRepositoryFunctions('web.main.permissions', mainPermissionRepository),
            users: wrapRepositoryFunctions('web.main.users', mainUserRepository),
          },
        },
      },
    },
  };
}

module.exports = { createRuntimeDependencies };
