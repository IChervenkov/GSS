const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Joi = require('joi');

const { requireFresh } = require('../../helpers/module-mocks');
const { startServer, requestJson } = require('../../helpers/http');

test('api auth route POST /api/token returns rotated token pair', async () => {
  const routerModule = requireFresh('src/modules/api/auth/auth.routes.ts', {
    'src/modules/api/auth/auth.module.ts': {
      createAuthModule: () => ({
        controller: {
          checkLoginApp: (_req, res) => res.status(200).json({ success: true, validUsername: true }),
          logout: (_req, res) => res.status(200).json({ success: true }),
          requestShowQr: (_req, res) => res.status(200).json({ success: true }),
          token: (_req, res) => res.status(200).json({ accessToken: 'a', refreshToken: 'b' }),
          twoFactorVerifiedDevice: (_req, res) =>
            res.status(200).json({ qrCodeDataURL: 'data:image/png;base64,a', secret: 'secret' }),
          verifyDevice: (_req, res) => res.status(200).json({ accessToken: 'a', refreshToken: 'b' }),
        },
      }),
    },
    'src/modules/api/auth/presentation/http/auth.request.dto.ts': {
      logoutRequestDto: Joi.object({ refreshToken: Joi.string().required() }).required(),
      mobileLoginRequestDto: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
      }).required(),
      mobileTwoFactorQueryDto: Joi.object({ username: Joi.string().required() }).required(),
      mobileVerifyDeviceRequestDto: Joi.object({
        code: Joi.string().required(),
        username: Joi.string().required(),
      }).required(),
      refreshTokenRequestDto: Joi.object({ refreshToken: Joi.string().required(), deviceId: Joi.string().required() }).required(),
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api', routerModule.createApiAuthRouter({ env: {} }));
  const server = await startServer(app);
  try {
    const { response, body } = await requestJson(server.baseUrl, '/api/token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'old', deviceId: 'device-1' }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, { accessToken: 'a', refreshToken: 'b' });
  } finally {
    await server.close();
  }
});
