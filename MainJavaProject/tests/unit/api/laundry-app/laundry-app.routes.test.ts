const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');

const {
  createApiLaundryAppRouter,
} = require('../../../../src/modules/api/laundry-app/laundry-app.routes');
const { startServer, requestJson } = require('../../../helpers/http');

test('laundry app camp list preserves per-user access flags', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.use(
    '/api',
    createApiLaundryAppRouter({
      repositories: {
        laundry: {},
        main: {
          listCampsAndPermissions: async ({ userId }) => {
            assert.equal(userId, 'user-1');
            return {
              camps: [
                {
                  id: 'camp-1',
                  name: 'Camp One',
                  createdAt: '2026-05-13',
                  canAccess: false,
                },
              ],
            };
          },
        },
      },
    }),
  );

  const server = await startServer(app);
  try {
    const result = await requestJson(server.baseUrl, '/api/laundry-app/camps');

    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.camps, [
      {
        id: 'camp-1',
        name: 'Camp One',
        createdAt: '2026-05-13',
        canAccess: false,
      },
    ]);
  } finally {
    await server.close();
  }
});

test('laundry app download returns the exact APK bytes instead of JSON', async () => {
  const apkBuffer = fs.readFileSync(__filename);
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.use(
    '/api',
    createApiLaundryAppRouter({
      env: {
        APP_LAUNDRY_FILE_PATH: __filename,
        HASH_APP_LAUNDRY: crypto.createHash('sha256').update(apkBuffer).digest('hex'),
      },
      repositories: {
        laundry: {
          userHasPermission: async () => true,
        },
        main: {},
      },
    }),
  );
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/laundry-app/mobile-app`);
    const downloaded = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/vnd.android.package-archive');
    assert.match(response.headers.get('content-disposition') || '', /^attachment; filename=/);
    assert.deepEqual(downloaded, apkBuffer);
  } finally {
    await server.close();
  }
});
