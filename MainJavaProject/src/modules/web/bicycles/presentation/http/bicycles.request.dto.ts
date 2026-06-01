const Joi = require('joi');
const { emptyBodyRequestDto } = require('../../../../../shared/http/request-dto-helpers');

const SAFE_SEARCH_PATTERN = /^(?!\s)(?!.*\s{2,})[\p{L}\p{N} _.:/-]+(?<!\s)$/u;
const SAFE_BICYCLE_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const SAFE_NFC_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const SAFE_HELMET_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseStateJson(value, helpers) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    return helpers.error('any.invalid');
  }

  return helpers.error('any.invalid');
}

const listLookupRequestDto = Joi.object({
  search: Joi.string().trim().allow('').max(64).pattern(SAFE_SEARCH_PATTERN).default(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
  identifier: Joi.string()
    .allow('', null)
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleAddRequestDto = Joi.object({
  name: Joi.string().trim().min(2).max(64).pattern(SAFE_BICYCLE_NAME_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleEditRequestDto = Joi.object({
  identifier: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  name: Joi.string().trim().min(2).max(64).pattern(SAFE_BICYCLE_NAME_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  status: Joi.string().valid('rented', 'repair', 'long_term').optional(),
  soldierId: Joi.string()
    .allow('', null)
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
  helmetId: Joi.string()
    .allow('', null)
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
  rentedAt: Joi.date().iso().optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleDeleteRequestDto = Joi.object({
  identifier: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const helmetAddRequestDto = Joi.object({
  code: Joi.string().trim().min(2).max(64).pattern(SAFE_HELMET_CODE_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const helmetEditRequestDto = Joi.object({
  helmetId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  code: Joi.string().trim().min(2).max(64).pattern(SAFE_HELMET_CODE_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const helmetDeleteRequestDto = Joi.object({
  helmetId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleRentRequestDto = Joi.object({
  identifier: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  repair: Joi.boolean().strict().default(false),
  soldierId: Joi.when('repair', {
    is: true,
    then: Joi.string()
      .allow('', null)
      .uuid({ version: ['uuidv4', 'uuidv5'] })
      .optional(),
    otherwise: Joi.string()
      .uuid({ version: ['uuidv4', 'uuidv5'] })
      .required(),
  }),
  helmetId: Joi.string()
    .allow('', null)
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
  rentedAt: Joi.date().iso().required(),
  longTerm: Joi.boolean().strict().default(false),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleReturnRequestDto = Joi.object({
  identifier: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  returnedAt: Joi.date().iso().required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleImportRequestDto = emptyBodyRequestDto;
const helmetImportRequestDto = emptyBodyRequestDto;

const bicycleOverviewRequestDto = Joi.object({
  state: Joi.alternatives()
    .try(
      Joi.object().unknown(true),
      Joi.string().allow('').max(20000).custom(parseStateJson),
    )
    .default({}),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleReportRequestDto = Joi.object({
  fromDate: Joi.string().trim().pattern(REPORT_DATE_PATTERN).required(),
  toDate: Joi.string().trim().pattern(REPORT_DATE_PATTERN).required(),
  state: Joi.alternatives()
    .try(
      Joi.object().unknown(true),
      Joi.string().allow('').max(20000).custom(parseStateJson),
    )
    .default({}),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleReportAssetRequestDto = Joi.object({
  assetType: Joi.string().valid('bicycle', 'helmet').required(),
  assetId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  limit: Joi.number().integer().min(1).max(10).default(2),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleReportSoldierRequestDto = Joi.object({
  soldierId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleReportAssetLookupRequestDto = Joi.object({
  assetType: Joi.string().valid('bicycle', 'helmet').required(),
  search: Joi.string().trim().allow('').max(64).pattern(SAFE_SEARCH_PATTERN).default(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleReportSoldierLookupRequestDto = Joi.object({
  search: Joi.string().trim().allow('').max(64).pattern(SAFE_SEARCH_PATTERN).default(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

module.exports = {
  bicycleAddRequestDto,
  bicycleDeleteRequestDto,
  bicycleEditRequestDto,
  bicycleImportRequestDto,
  bicycleReportAssetLookupRequestDto,
  bicycleOverviewRequestDto,
  bicycleReportAssetRequestDto,
  bicycleReportRequestDto,
  bicycleReportSoldierLookupRequestDto,
  bicycleReportSoldierRequestDto,
  bicycleRentRequestDto,
  bicycleReturnRequestDto,
  helmetAddRequestDto,
  helmetDeleteRequestDto,
  helmetEditRequestDto,
  helmetImportRequestDto,
  listLookupRequestDto,
};
