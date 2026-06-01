const test = require('node:test');
const assert = require('node:assert/strict');

const validate = require('../../../src/shared/http/validate');
const { createNextRecorder } = require('../../helpers/fakes');

test('validate writes sanitized payload back to the selected request source', async () => {
  const middleware = validate({
    validate(value) {
      return { error: null, value: { username: String(value.username).trim().toLowerCase() } };
    },
  });

  const req = { body: { username: '  ADMIN ' } };
  const { next, calls } = createNextRecorder();
  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], null);
  assert.deepEqual(req.body, { username: 'admin' });
});

test('validate ignores hidden csrf form field before body DTO validation', async () => {
  const middleware = validate({
    validate(value) {
      assert.deepEqual(value, { username: 'admin' });
      return { error: null, value };
    },
  });

  const req = { body: { username: 'admin', _csrf: 'csrf-token' } };
  const { next, calls } = createNextRecorder();
  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], null);
  assert.deepEqual(req.body, { username: 'admin' });
});

test('validate forwards VALIDATION_ERROR with structured details', async () => {
  const middleware = validate({
    validate() {
      return {
        error: {
          details: [{ message: '"username" is required', path: ['username'] }],
        },
        value: null,
      };
    },
  });

  const req = { body: {} };
  const { next, calls } = createNextRecorder();
  middleware(req, {}, next);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 422);
  assert.equal(calls[0].code, 'VALIDATION_ERROR');
  assert.deepEqual(calls[0].details, [{ message: '"username" is required', path: ['username'] }]);
});
