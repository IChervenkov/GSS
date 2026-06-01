const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFresh } = require('../../../helpers/module-mocks');

const buildFixture = (name) => `fixture-${name}`;
const currentPasswordHash = buildFixture('current-password-hash');
const tempPasswordHash = buildFixture('temporary-password-hash');
const nextPasswordHash = buildFixture('next-password-hash');

test('listUsers keeps a pending request id available for the user table query', async () => {
  const queries = [];
  const fakeRows = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'operator@globalrts.gss',
      is_locked: false,
      pending_request_id: '22222222-2222-2222-2222-222222222222',
      pending_request_type: 'show_qr',
      pending_request_expires_at: '2035-01-01T00:00:00.000Z',
      status: 'pending',
    },
  ];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql) {
              queries.push(sql);
              if (sql.includes('SELECT COUNT(*)::int AS count')) {
                return { rows: [{ count: 1 }] };
              }

              return { rows: fakeRows };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called in listUsers test');
        },
      },
    },
  );

  const result = await repository.listUsers({
    adminUsername: 'admin@globalrts.gss',
    page: 1,
    limit: 10,
    filters: [],
    sort: {
      column: 'u.username',
      direction: 'asc',
    },
  });

  assert.deepEqual(result, {
    users: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'operator@globalrts.gss',
        isLocked: false,
        pendingRequestId: '22222222-2222-2222-2222-222222222222',
        pendingRequestType: 'show_qr',
        pendingRequestExpiresAt: '2035-01-01T00:00:00.000Z',
        status: 'pending',
      },
    ],
    total: 1,
  });

  const usersQuery = queries.find((sql) => sql.includes('FROM app.users u'));
  assert.ok(usersQuery, 'expected the users query to run');
  assert.match(usersQuery, /COALESCE\(\s*pending_request\.request_id,/);
  assert.match(usersQuery, /COALESCE\(\s*pending_request\.expires_at,/);
  assert.match(
    usersQuery,
    /latest_request\.status = 'pending' AND latest_request\.expires_at > NOW\(\)/,
  );
  assert.match(usersQuery, /THEN 'expired'/);
  assert.match(usersQuery, /SELECT r\.request_id, r\.type, r\.status, r\.expires_at/);
});

test('listAdminInbox applies allowlisted column search and sorting', async () => {
  const queries = [];
  const fakeRows = [
    {
      id: 'message:33333333-3333-3333-3333-333333333333',
      source_id: '33333333-3333-3333-3333-333333333333',
      kind: 'user_message',
      type: 'suggestion',
      status: 'open',
      subject: 'Access idea',
      body: 'Please improve access reports.',
      user_id: '11111111-1111-1111-1111-111111111111',
      username: 'operator@globalrts.gss',
      created_at: '2035-01-01T12:30:00.000Z',
      expires_at: null,
    },
  ];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              if (sql.includes('SELECT COUNT(*)::int AS count')) {
                return { rows: [{ count: 1 }] };
              }

              return { rows: fakeRows };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called in listAdminInbox test');
        },
      },
    },
  );

  const result = await repository.listAdminInbox({
    page: 2,
    limit: 10,
    filters: [{ column: 'subject', value: 'Access' }],
    sort: { column: 'username', direction: 'asc' },
  });

  assert.deepEqual(result, {
    items: [
      {
        id: 'message:33333333-3333-3333-3333-333333333333',
        sourceId: '33333333-3333-3333-3333-333333333333',
        kind: 'user_message',
        type: 'suggestion',
        status: 'open',
        subject: 'Access idea',
        body: 'Please improve access reports.',
        userId: '11111111-1111-1111-1111-111111111111',
        username: 'operator@globalrts.gss',
        createdAt: '2035-01-01T12:30:00.000Z',
        expiresAt: null,
      },
    ],
    total: 1,
  });

  const inboxQuery = queries.find((entry) => entry.sql.includes('SELECT *'));
  assert.ok(inboxQuery, 'expected the admin inbox query to run');
  assert.match(inboxQuery.sql, /WHERE subject ILIKE \$1/);
  assert.match(inboxQuery.sql, /ORDER BY username ASC, id DESC/);
  assert.match(inboxQuery.sql, /to_char\(m\.created_at, 'YYYY-MM-DD HH12-MI AM'\)/);
  assert.deepEqual(inboxQuery.params, ['%Access%', 10, 10]);
});

test('updateUserMessageStatus casts closed_by actor id as uuid', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return {
                rowCount: 1,
                rows: [
                  {
                    id: '33333333-3333-3333-3333-333333333333',
                    user_id: null,
                    type: 'message',
                    subject: 'Access request',
                    body: 'Please add access.',
                    status: 'closed',
                    created_at: '2035-01-01T12:30:00.000Z',
                  },
                ],
              };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called in updateUserMessageStatus test');
        },
      },
    },
  );

  const result = await repository.updateUserMessageStatus({
    messageId: '33333333-3333-3333-3333-333333333333',
    status: 'closed',
    actorUserId: '11111111-1111-1111-1111-111111111111',
  });

  assert.equal(result.status, 'closed');
  const updateQuery = queries.find((entry) => entry.sql.includes('UPDATE app.user_messages'));
  assert.ok(updateQuery, 'expected the user message update query to run');
  assert.match(updateQuery.sql, /closed_by = CASE WHEN \$2 = 'closed' THEN \$3::uuid ELSE NULL::uuid END/);
  assert.deepEqual(updateQuery.params, [
    '33333333-3333-3333-3333-333333333333',
    'closed',
    '11111111-1111-1111-1111-111111111111',
  ]);
});

test('deleteAdminInboxItem removes user messages by id', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return {
                rowCount: 1,
                rows: [
                  {
                    id: '33333333-3333-3333-3333-333333333333',
                    user_id: null,
                    type: 'message',
                    subject: 'Access request',
                    body: 'Please add access.',
                    status: 'open',
                    created_at: '2035-01-01T12:30:00.000Z',
                  },
                ],
              };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called in deleteAdminInboxItem test');
        },
      },
    },
  );

  const result = await repository.deleteAdminInboxItem({
    itemId: '33333333-3333-3333-3333-333333333333',
    itemKind: 'user_message',
  });

  assert.equal(result.kind, 'user_message');
  assert.equal(result.sourceId, '33333333-3333-3333-3333-333333333333');
  const deleteQuery = queries.find((entry) => entry.sql.includes('DELETE FROM app.user_messages'));
  assert.ok(deleteQuery, 'expected the user message delete query to run');
  assert.deepEqual(deleteQuery.params, ['33333333-3333-3333-3333-333333333333']);
});

test('deleteAdminInboxItem removes access requests by request id', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });
              return {
                rowCount: 1,
                rows: [
                  {
                    request_id: '33333333-3333-3333-3333-333333333333',
                    user_id: '22222222-2222-2222-2222-222222222222',
                    type: 'show_qr',
                    status: 'pending',
                    metadata: { message: 'Need QR access.' },
                    created_at: '2035-01-01T12:30:00.000Z',
                    expires_at: '2035-01-01T12:35:00.000Z',
                  },
                ],
              };
            },
          }),
        withTransaction: async () => {
          throw new Error('withTransaction should not be called in deleteAdminInboxItem test');
        },
      },
    },
  );

  const result = await repository.deleteAdminInboxItem({
    itemId: '33333333-3333-3333-3333-333333333333',
    itemKind: 'access_request',
  });

  assert.equal(result.kind, 'access_request');
  assert.equal(result.sourceId, '33333333-3333-3333-3333-333333333333');
  assert.equal(result.body, 'Need QR access.');
  const deleteQuery = queries.find((entry) => entry.sql.includes('DELETE FROM app.user_requests'));
  assert.ok(deleteQuery, 'expected the access request delete query to run');
  assert.deepEqual(deleteQuery.params, ['33333333-3333-3333-3333-333333333333']);
});

test('updateUser replaces only the temporary password when that is the active credential', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called in updateUser test');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });

              if (sql.includes('FOR UPDATE')) {
                return {
                  rows: [
                    {
                      id: '22222222-2222-2222-2222-222222222222',
                      username: 'old.user',
                      password: null,
                      temporary_password: tempPasswordHash,
                      is_locked: false,
                    },
                  ],
                };
              }

              return { rows: [], rowCount: 1 };
            },
          }),
      },
    },
  );

  const result = await repository.updateUser({
    actorUserId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    username: 'new.user',
    passwordHash: nextPasswordHash,
  });

  assert.deepEqual(result, {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'old.user',
    password: null,
    temporaryPassword: tempPasswordHash,
    isLocked: false,
  });

  const updateQuery = queries.find((entry) => entry.sql.includes('UPDATE app.users'));
  assert.ok(updateQuery, 'expected the update query to run');
  assert.match(updateQuery.sql, /username = \$2/);
  assert.ok(!/[\s,]password =/.test(updateQuery.sql));
  assert.match(updateQuery.sql, /temporary_password = \$3/);
  assert.deepEqual(updateQuery.params, [
    '22222222-2222-2222-2222-222222222222',
    'new.user',
    nextPasswordHash,
  ]);
});

test('updateUser replaces both stored password values when both exist', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called in updateUser test');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });

              if (sql.includes('FOR UPDATE')) {
                return {
                  rows: [
                    {
                      id: '22222222-2222-2222-2222-222222222222',
                      username: 'old.user',
                      password: currentPasswordHash,
                      temporary_password: tempPasswordHash,
                      is_locked: false,
                    },
                  ],
                };
              }

              return { rows: [], rowCount: 1 };
            },
          }),
      },
    },
  );

  await repository.updateUser({
    actorUserId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    username: 'new.user',
    passwordHash: nextPasswordHash,
  });

  const updateQuery = queries.find((entry) => entry.sql.includes('UPDATE app.users'));
  assert.ok(updateQuery, 'expected the update query to run');
  assert.match(updateQuery.sql, /password = \$3/);
  assert.match(updateQuery.sql, /temporary_password = \$3/);
  assert.deepEqual(updateQuery.params, [
    '22222222-2222-2222-2222-222222222222',
    'new.user',
    nextPasswordHash,
  ]);
});

test('updateUser persists the account lock flag when it changes', async () => {
  const queries = [];

  const repository = requireFresh(
    'src/modules/web/main-page/infrastructure/repositories/user.repository.ts',
    {
      'src/infrastructure/db/transaction.ts': {
        withClient: async () => {
          throw new Error('withClient should not be called in updateUser test');
        },
        withTransaction: async (callback) =>
          callback({
            async query(sql, params) {
              queries.push({ sql, params });

              if (sql.includes('FOR UPDATE')) {
                return {
                  rows: [
                    {
                      id: '22222222-2222-2222-2222-222222222222',
                      username: 'old.user',
                      password: currentPasswordHash,
                      temporary_password: null,
                      is_locked: false,
                    },
                  ],
                };
              }

              return { rows: [], rowCount: 1 };
            },
          }),
      },
    },
  );

  await repository.updateUser({
    actorUserId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    username: 'new.user',
    passwordHash: null,
    locked: true,
  });

  const updateQuery = queries.find((entry) => entry.sql.includes('UPDATE app.users'));
  assert.ok(updateQuery, 'expected the update query to run');
  assert.match(updateQuery.sql, /is_locked = \$3/);
  assert.deepEqual(updateQuery.params, ['22222222-2222-2222-2222-222222222222', 'new.user', true]);
});
