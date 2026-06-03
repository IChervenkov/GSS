// @ts-nocheck
const { isUuid } = require('./event-catalog');
const { verifyAccessToken } = require('../../modules/api/auth/infrastructure/security/auth.tokens');

function extractToken(socket) {
  const fromAuth = socket.handshake.auth?.token;
  const fromHeader = socket.handshake.headers?.authorization;
  const raw = fromAuth || fromHeader;
  if (!raw) return null;
  return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
}

function createInvalidSocketError(code, message) {
  const err = new Error(message || code);
  err.data = { code };
  return err;
}

function resolveSessionPrincipal(session) {
  const sessionUserId =
    session?.userId || session?.pendingUserId || session?.pendingPasswordChangeUserId;
  if (!sessionUserId) return null;

  const userId = String(sessionUserId);
  if (!isUuid(userId)) {
    throw createInvalidSocketError('INVALID_SESSION_USER', 'Socket session principal is invalid.');
  }

  return {
    id: userId,
    userId,
    sub: userId,
    username: null,
    tokenType: null,
    deviceId: null,
    tokenVersion: 0,
    jti: null,
    via: session?.userId
      ? 'session'
      : session?.pendingUserId
        ? 'pending-session'
        : 'password-change-session',
    authType: 'session',
  };
}

async function enforceLiveTokenVersion(principal, repository) {
  if (typeof repository?.getUserTokenState !== 'function') return principal;
  const tokenState = await repository.getUserTokenState(principal.id);
  if (!tokenState || Number(tokenState.tokenVersion || 0) !== Number(principal.tokenVersion || 0)) {
    throw createInvalidSocketError('INVALID_TOKEN', 'Socket token is invalid or expired.');
  }
  return principal;
}

function verifyJwtPrincipal({ token, env }) {
  if (!token) return null;
  const principal = verifyAccessToken(env, token);
  if (!isUuid(principal.id)) {
    throw createInvalidSocketError('INVALID_USER', 'Socket token principal is invalid.');
  }
  return principal;
}

function toSocketAuthError(error) {
  if (error?.data?.code) return error;
  return createInvalidSocketError('INVALID_TOKEN', error?.message || 'Invalid socket credentials.');
}

function createSocketSessionValidator({ env, logger, repository, metrics } = {}) {
  const authLogger = logger?.child?.({ component: 'socket-auth' }) || logger;

  return function validateSocketSession(io, sessionMiddleware) {
    io.engine.use((req, res, next) => sessionMiddleware(req, res, next));

    io.use((socket, next) => {
      const finishWithError = (error) => {
        const mapped = toSocketAuthError(error);
        metrics?.counter?.('gss_socket_auth_failures_total', {
          code: mapped?.data?.code || 'INVALID_TOKEN',
          authType: socket.handshake.auth?.token || socket.handshake.headers?.authorization ? 'jwt' : 'session',
        });
        authLogger?.warn?.('socket_auth_failed', {
          socketId: socket.id,
          code: mapped?.data?.code || 'INVALID_TOKEN',
          errorMessage: mapped?.message,
        });
        return next(mapped);
      };

      try {
        const sessionPrincipal = resolveSessionPrincipal(socket.request?.session || socket.handshake.session);
        if (sessionPrincipal) {
          socket.user = sessionPrincipal;
          return next();
        }

        const token = extractToken(socket);
        const principal = verifyJwtPrincipal({ token, env });
        if (!principal) {
          return next(createInvalidSocketError('INVALID_TOKEN', 'Missing session or token.'));
        }

        if (typeof repository?.getUserTokenState === 'function') {
          return Promise.resolve(enforceLiveTokenVersion(principal, repository))
            .then((resolvedPrincipal) => {
              socket.user = resolvedPrincipal;
              return next();
            })
            .catch(finishWithError);
        }

        socket.user = principal;
        return next();
      } catch (error) {
        return finishWithError(error);
      }
    });
  };
}

module.exports = { createSocketSessionValidator, extractToken };
