const Joi = require('joi');

const refreshTokenRequestDto = Joi.object({
  refreshToken: Joi.string().trim().required(),
  deviceId: Joi.string().trim().allow('', null).optional(),
  clientFingerprint: Joi.string().trim().max(512).allow('', null).optional(),
});

const logoutRequestDto = Joi.object({
  refreshToken: Joi.string().trim().required(),
  deviceId: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const mobileLoginRequestDto = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().trim().required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const mobileTwoFactorQueryDto = Joi.object({
  username: Joi.string().trim().required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const mobileVerifyDeviceRequestDto = Joi.object({
  code: Joi.string().trim().pattern(/^\d{6}$/).required(),
  userSecret: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  username: Joi.string().trim().required(),
  deviceId: Joi.string().trim().allow('', null).optional(),
  deviceName: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

module.exports = {
  logoutRequestDto,
  mobileLoginRequestDto,
  mobileTwoFactorQueryDto,
  mobileVerifyDeviceRequestDto,
  refreshTokenRequestDto,
};
