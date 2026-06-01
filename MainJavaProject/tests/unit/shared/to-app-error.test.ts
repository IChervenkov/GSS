const test = require('node:test');
const assert = require('node:assert/strict');

const { toAppError } = require('../../../src/shared/errors/to-app-error');
const { AppError } = require('../../../src/shared/errors/app-error');
const { ERROR_CODES } = require('../../../src/shared/errors/error-codes');

test('toAppError preserves AppError instances', async () => {
  const original = new AppError({ status: 409, code: 'X', message: 'y' });
  assert.equal(toAppError(original), original);
});

test('toAppError maps csrf errors to industrial security message', async () => {
  const error = toAppError({ code: 'EBADCSRFTOKEN' });
  assert.equal(error.status, 403);
  assert.equal(error.code, ERROR_CODES.EBADCSRFTOKEN);
});

test('toAppError maps unknown errors into INTERNAL_ERROR shape', async () => {
  const error = toAppError(new Error('boom'));
  assert.equal(error.status, 500);
  assert.equal(error.code, ERROR_CODES.INTERNAL_ERROR);
  assert.equal(error.message, 'boom');
});
