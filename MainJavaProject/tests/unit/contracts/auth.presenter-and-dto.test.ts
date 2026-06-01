const test = require('node:test');
const assert = require('node:assert/strict');

const { authSuccess } = require('../../../src/shared/application/action-result');
const { presentTokenResponse } = require('../../../src/modules/api/auth/presentation/auth.presenter');
const {
  toRefreshTokenResponseDto,
} = require('../../../src/modules/api/auth/presentation/http/auth.response.dto');
const {
  refreshTokenRequestDto,
} = require('../../../src/modules/api/auth/presentation/http/auth.request.dto');
const {
  presentAuthAction,
  presentVerifyView,
  presentChangePasswordView,
} = require('../../../src/modules/web/auth/presentation/auth.presenter');
const {
  toAuthActionResponseDto,
  toVerifyViewResponseDto,
  toChangePasswordViewResponseDto,
} = require('../../../src/modules/web/auth/presentation/http/auth.response.dto');
const {
  loginRequestDto,
  requestAccessRequestDto,
  verifyCodeRequestDto,
} = require('../../../src/modules/web/auth/presentation/http/auth.request.dto');

test('api auth presenter and DTOs normalize refresh payloads', () => {
  const dto = toRefreshTokenResponseDto({ accessToken: 'a', refreshToken: 'r' });
  assert.deepEqual(dto, { accessToken: 'a', refreshToken: 'r' });

  const presented = presentTokenResponse({ accessToken: 'a', refreshToken: 'r' });
  assert.equal(presented.status, 200);
  assert.deepEqual(presented.body, dto);

  const validated = refreshTokenRequestDto.validate({
    refreshToken: 'refresh-1',
    deviceId: 'device-1',
    clientFingerprint: 'fingerprint-1',
  });
  assert.equal(validated.error, undefined);
});

test('web auth presenter and DTOs normalize action and view models', () => {
  const action = authSuccess('mainPage', { message: 'ok' });
  assert.deepEqual(toAuthActionResponseDto(action), {
    message: 'ok',
    redirectTo: '/web/main-page',
  });

  const presented = presentAuthAction(action);
  assert.equal(presented.status, 200);
  assert.deepEqual(presented.body, {
    message: 'ok',
    redirectTo: '/web/main-page',
  });

  assert.deepEqual(
    toVerifyViewResponseDto({ title: '2FA Verification', qrCodeDataURL: 'data:abc', csrfToken: 'csrf' }),
    { title: '2FA Verification', qrCodeDataURL: 'data:abc', csrfToken: 'csrf' },
  );
  assert.deepEqual(
    toChangePasswordViewResponseDto({ title: 'Change Password', csrfToken: 'csrf' }),
    { title: 'Change Password', csrfToken: 'csrf' },
  );

  assert.equal(presentVerifyView({ title: '2FA Verification' }).view, 'verify-qr-code');
  assert.equal(presentChangePasswordView({ title: 'Change Password' }).view, 'change-password');

  assert.equal(loginRequestDto.validate({ username: 'user', password: 'pw' }).error, undefined);
  assert.equal(
    requestAccessRequestDto.validate({
      name: 'Alex Johnson',
      email: 'alex@example.com',
      team: 'Operations',
      access: 'operations',
      reason: 'Needs access for daily support work.',
    }).error,
    undefined,
  );
  assert.equal(verifyCodeRequestDto.validate({ code: '123456' }).error, undefined);
});
