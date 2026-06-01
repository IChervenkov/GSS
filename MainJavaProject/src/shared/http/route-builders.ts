const { updateRequestContext } = require('../observability/request-context');
const validate = require('./validate');
const { asyncHandler } = require('./async-handler');
const { isResponseContract, sendResponseContract } = require('./response-contract');

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function isSchemaCandidate(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.validate === 'function';
}

function isFunction(value) {
  return typeof value === 'function';
}

function buildRoute(router, method, path, ...args) {
  const middlewares = [];
  let schema = null;

  for (const arg of args) {
    if (!arg) continue;

    if (isSchemaCandidate(arg)) {
      if (schema) {
        throw new Error(
          `Only one validation schema is allowed for ${method.toUpperCase()} ${path}`,
        );
      }
      schema = arg;
      continue;
    }

    if (!isFunction(arg)) {
      throw new Error(`Invalid route argument for ${method.toUpperCase()} ${path}`);
    }

    middlewares.push(
      asyncHandler(async (req, res, next) => {
        const baseSegments = String(req.baseUrl || '')
          .split('/')
          .filter(Boolean);
        updateRequestContext({
          userId: req.session?.userId || req.user?.id,
          pendingUserId: req.session?.pendingUserId,
          module: baseSegments.slice(-2).join(':') || baseSegments[0] || 'root',
          useCase: `${method.toUpperCase()} ${path}`,
        });
        const result = await arg(req, res, next);
        if (!res.headersSent && isResponseContract(result)) {
          return sendResponseContract(res, result);
        }
        return result;
      }),
    );
  }

  if (MUTATING_METHODS.has(method) && !schema) {
    throw new Error(
      `Validation schema is required for mutating route ${method.toUpperCase()} ${path}`,
    );
  }

  if (schema) {
    middlewares.unshift(validate(schema, method === 'get' ? 'query' : 'body'));
  }

  router[method](path, ...middlewares);
}

function buildGetRoute(router, path, ...args) {
  buildRoute(router, 'get', path, ...args);
}

function buildPostRoute(router, path, ...args) {
  buildRoute(router, 'post', path, ...args);
}

function buildPutRoute(router, path, ...args) {
  buildRoute(router, 'put', path, ...args);
}

function buildPatchRoute(router, path, ...args) {
  buildRoute(router, 'patch', path, ...args);
}

function buildDeleteRoute(router, path, ...args) {
  buildRoute(router, 'delete', path, ...args);
}

module.exports = {
  buildGetRoute,
  buildPostRoute,
  buildPutRoute,
  buildPatchRoute,
  buildDeleteRoute,
};
