const test = require('node:test');
const assert = require('node:assert/strict');

const { mapDbError } = require('../../../src/infrastructure/db/transaction');
const { AppError } = require('../../../src/shared/errors/app-error');

test('mapDbError normalizes duplicate, foreign-key, concurrency, and check-constraint failures', () => {
  const cases = [
    [{ code: '23505' }, 409, 'DUPLICATE_DATA'],
    [{ code: '23503' }, 409, 'REFERENCE_CONSTRAINT_VIOLATION'],
    [{ code: '40001' }, 409, 'CONCURRENT_WRITE_CONFLICT'],
    [{ code: '40P01' }, 409, 'CONCURRENT_WRITE_CONFLICT'],
    [{ code: '23514' }, 400, 'INVALID_PERSISTED_DATA'],
    [{ code: '23502' }, 400, 'INVALID_PERSISTED_DATA'],
  ];

  for (const [input, status, code] of cases) {
    const mapped = mapDbError(input);
    assert.ok(mapped instanceof AppError);
    assert.equal(mapped.status, status);
    assert.equal(mapped.code, code);
  }
});
