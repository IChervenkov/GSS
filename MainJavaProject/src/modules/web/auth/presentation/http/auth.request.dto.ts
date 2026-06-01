const Joi = require('joi');
const { STRONG_PASSWORD_PATTERN } = require('../../domain/auth.policy');
const { emptyBodyRequestDto, strictDto } = require('../../../../../shared/http/request-dto-helpers');

const ACCESS_NEEDS = Object.freeze([
  'operations',
  'inventory',
  'accommodation',
  'laundry',
  'admin',
]);

const passwordChangeRequestDto = strictDto(Joi.object({
  username: Joi.string().trim().max(128).required(),
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword: Joi.string().pattern(STRONG_PASSWORD_PATTERN).required(),
}));

const verifyAdminDecisionRequestDto = strictDto(Joi.object({
  requestId: Joi.string()
    .guid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  decision: Joi.string().valid('approved', 'denied').required(),
}));

const loginRequestDto = strictDto(Joi.object({
  username: Joi.string().trim().max(128).required(),
  password: Joi.string().min(1).max(128).required(),
}));

const requestAccessRequestDto = strictDto(Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().email({ tlds: false }).max(160).required(),
  team: Joi.string().trim().allow('').max(120).optional(),
  access: Joi.string()
    .valid(...ACCESS_NEEDS)
    .required(),
  reason: Joi.string().trim().min(10).max(2000).required(),
}));

const verifyCodeRequestDto = strictDto(Joi.object({
  code: Joi.string()
    .trim()
    .pattern(/^[0-9]{6}$/)
    .required(),
}));

const approvedQrPayloadQueryDto = strictDto(Joi.object({
  requestId: Joi.string()
    .guid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
}));

const requestQrRequestDto = emptyBodyRequestDto;
const logoutRequestDto = emptyBodyRequestDto;

module.exports = {
  passwordChangeRequestDto,
  verifyAdminDecisionRequestDto,
  loginRequestDto,
  requestAccessRequestDto,
  verifyCodeRequestDto,
  approvedQrPayloadQueryDto,
  requestQrRequestDto,
  logoutRequestDto,
};
