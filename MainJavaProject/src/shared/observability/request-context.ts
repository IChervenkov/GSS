const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function getRequestContext() {
  return storage.getStore() || {};
}

function runWithRequestContext(context, callback) {
  return storage.run({ ...(context || {}) }, callback);
}

function updateRequestContext(partial = {}) {
  const current = getRequestContext();
  if (!current || Object.keys(current).length === 0) return;
  Object.assign(current, partial);
}

function withRequestContext(partial = {}, callback) {
  const current = getRequestContext();
  return storage.run({ ...(current || {}), ...(partial || {}) }, callback);
}

module.exports = {
  getRequestContext,
  runWithRequestContext,
  updateRequestContext,
  withRequestContext,
};
