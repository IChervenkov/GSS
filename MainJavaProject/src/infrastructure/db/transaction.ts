const { pool } = require('./pool');
const { AppError } = require('../../shared/errors/app-error');

function mapDbError(error) {
  if (!error) return error;

  if (error?.code === '23505') {
    return new AppError({
      status: 409,
      code: 'DUPLICATE_DATA',
      message: 'This data already exists.',
    });
  }

  if (error?.code === '40001' || error?.code === '40P01') {
    return new AppError({
      status: 409,
      code: 'CONCURRENT_WRITE_CONFLICT',
      message: 'The data was changed concurrently. Please retry the operation.',
    });
  }

  if (error?.code === '23503') {
    return new AppError({
      status: 409,
      code: 'REFERENCE_CONSTRAINT_VIOLATION',
      message: 'The operation violates a related data constraint.',
    });
  }

  if (error?.code === '23514' || error?.code === '23502') {
    return new AppError({
      status: 400,
      code: 'INVALID_PERSISTED_DATA',
      message: `The operation violates a required data rule. ${error}`,
    });
  }

  return error;
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } catch (error) {
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function withTransaction(fn) {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

module.exports = { withClient, withTransaction, mapDbError };
