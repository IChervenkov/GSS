// @ts-nocheck
function toRefreshTokenResponseDto(model = {}) {
  return {
    accessToken: String(model?.accessToken || ''),
    refreshToken: String(model?.refreshToken || ''),
  };
}

module.exports = { toRefreshTokenResponseDto };
