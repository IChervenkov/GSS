const Joi = require('joi');
const { emptyBodyRequestDto } = require('../../../../../shared/http/request-dto-helpers');

const SAFE_SEARCH_PATTERN = /^(?!\s)(?!.*\s{2,})[\p{L}\p{N} _.:/-]+(?<!\s)$/u;
const SAFE_BAG_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.:/-]+$/u;
const SAFE_BAG_TYPE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const SAFE_RFID_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LAUNDRY_STATUSES = ['in_soldier', 'drop_off', 'laundry_facility', 'ready_to_pick_up', 'pick_up'];
const ACTIVE_STATUSES = ['drop_off', 'laundry_facility', 'ready_to_pick_up'];

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

const laundryOverviewRequestDto = Joi.object({
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

const laundryReportRequestDto = Joi.object({
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

const laundryLookupRequestDto = Joi.object({
  search: Joi.string().trim().allow('').max(64).pattern(SAFE_SEARCH_PATTERN).default(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagAddRequestDto = Joi.object({
  code: Joi.string().trim().min(2).max(64).pattern(SAFE_BAG_CODE_PATTERN).required(),
  rfidCode: Joi.string().trim().min(2).max(128).pattern(SAFE_RFID_CODE_PATTERN).required(),
  type: Joi.string().trim().allow('', null).max(64).pattern(SAFE_BAG_TYPE_PATTERN).optional(),
  maxCountLaundry: Joi.number().integer().min(1).max(100000).default(1),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagEditRequestDto = Joi.object({
  bagId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  code: Joi.string().trim().min(2).max(64).pattern(SAFE_BAG_CODE_PATTERN).required(),
  rfidCode: Joi.string().trim().min(2).max(128).pattern(SAFE_RFID_CODE_PATTERN).required(),
  type: Joi.string().trim().allow('', null).max(64).pattern(SAFE_BAG_TYPE_PATTERN).optional(),
  maxCountLaundry: Joi.number().integer().min(1).max(100000).default(1),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagDeleteRequestDto = Joi.object({
  bagId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagStatusRequestDto = Joi.object({
  bagId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  status: Joi.string().valid(...LAUNDRY_STATUSES).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagAddToStatusRequestDto = Joi.object({
  bagId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  status: Joi.string().valid(...ACTIVE_STATUSES).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagRemoveFromStatusRequestDto = Joi.object({
  bagId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagLinenExchangeRequestDto = Joi.object({
  bagId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagBulkUpdateRequestDto = Joi.object({
  payload: Joi.string().trim().min(1).max(50000).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const laundryBagImportRequestDto = emptyBodyRequestDto;

module.exports = {
  laundryBagAddRequestDto,
  laundryBagAddToStatusRequestDto,
  laundryBagBulkUpdateRequestDto,
  laundryBagImportRequestDto,
  laundryBagLinenExchangeRequestDto,
  laundryBagDeleteRequestDto,
  laundryBagEditRequestDto,
  laundryBagRemoveFromStatusRequestDto,
  laundryBagStatusRequestDto,
  laundryLookupRequestDto,
  laundryOverviewRequestDto,
  laundryReportRequestDto,
};
