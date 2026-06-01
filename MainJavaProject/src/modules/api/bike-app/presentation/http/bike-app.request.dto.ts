const Joi = require('joi');

const UUID = Joi.string().uuid({ version: ['uuidv4', 'uuidv5'] });
const SAFE_SEARCH_PATTERN = /^(?!\s)(?!.*\s{2,})[\p{L}\p{N} _.:/-]*(?<!\s)$/u;
const SAFE_BICYCLE_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const SAFE_NFC_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const SAFE_HELMET_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;

function parseJsonObject(value, helpers) {
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

const campQueryDto = Joi.object({
  campId: UUID.required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const listQueryDto = Joi.object({
  campId: UUID.required(),
  search: Joi.string().trim().allow('').max(64).pattern(SAFE_SEARCH_PATTERN).default(''),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  filters: Joi.alternatives()
    .try(
      Joi.object().unknown(true),
      Joi.string().allow('').max(10000).custom(parseJsonObject),
    )
    .default({}),
  sortColumn: Joi.string()
    .trim()
    .allow('')
    .valid(
      '',
      'id',
      'name',
      'nfcCode',
      'status',
      'assignedSoldier',
      'helmetCode',
      'rentedAt',
      'code',
      'bicycleName',
    )
    .default(''),
  sortDirection: Joi.string().trim().valid('default', 'asc', 'desc').default('default'),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const nfcLookupQueryDto = Joi.object({
  campId: UUID.required(),
  nfcData: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const rentalsQueryDto = Joi.object({
  campId: UUID.required(),
  assetType: Joi.string().valid('bicycle', 'helmet').required(),
  assetId: UUID.required(),
  limit: Joi.number().integer().min(1).max(50).default(20),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assignmentsQueryDto = Joi.object({
  campId: UUID.required(),
  soldierId: UUID.required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleAddDto = Joi.object({
  campId: UUID.required(),
  name: Joi.string().trim().min(2).max(64).pattern(SAFE_BICYCLE_NAME_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleEditDto = Joi.object({
  campId: UUID.required(),
  identifier: UUID.required(),
  name: Joi.string().trim().min(2).max(64).pattern(SAFE_BICYCLE_NAME_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  status: Joi.string().valid('rented', 'repair', 'long_term').optional(),
  soldierId: UUID.allow('', null).optional(),
  helmetId: UUID.allow('', null).optional(),
  rentedAt: Joi.date().iso().optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const bicycleDeleteDto = Joi.object({
  campId: UUID.required(),
  identifier: UUID.required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const helmetAddDto = Joi.object({
  campId: UUID.required(),
  code: Joi.string().trim().min(2).max(64).pattern(SAFE_HELMET_CODE_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const helmetEditDto = Joi.object({
  campId: UUID.required(),
  helmetId: UUID.required(),
  code: Joi.string().trim().min(2).max(64).pattern(SAFE_HELMET_CODE_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const helmetDeleteDto = Joi.object({
  campId: UUID.required(),
  helmetId: UUID.required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const rentalCreateDto = Joi.object({
  campId: UUID.required(),
  identifier: UUID.required(),
  repair: Joi.boolean().strict().default(false),
  soldierId: Joi.when('repair', {
    is: true,
    then: UUID.allow('', null).optional(),
    otherwise: UUID.required(),
  }),
  helmetId: UUID.allow('', null).optional(),
  rentedAt: Joi.date().iso().required(),
  longTerm: Joi.boolean().strict().default(false),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const rentalReturnDto = Joi.object({
  campId: UUID.required(),
  identifier: UUID.required(),
  returnedAt: Joi.date().iso().required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyNfcLookupQueryDto = Joi.object({
  campId: UUID.allow('', null).optional(),
  nfcData: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyCheckBikeQueryDto = Joi.object({
  bikeId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyBikeAddDto = Joi.object({
  campId: UUID.required(),
  bikeName: Joi.string().trim().min(2).max(64).pattern(SAFE_BICYCLE_NAME_PATTERN).required(),
  bikeAddId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyHelmetAddDto = Joi.object({
  campId: UUID.required(),
  helmetName: Joi.string().trim().min(2).max(64).pattern(SAFE_HELMET_CODE_PATTERN).required(),
  helmetAddId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyBikeEditDto = Joi.object({
  campId: UUID.required(),
  oldNfcContent: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  oldBikeId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  newNfcContent: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  newBikeId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  bikeName: Joi.string().trim().min(2).max(64).pattern(SAFE_BICYCLE_NAME_PATTERN).required(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .or('oldNfcContent', 'oldBikeId')
  .or('newNfcContent', 'newBikeId')
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyHelmetEditDto = Joi.object({
  campId: UUID.required(),
  oldNfcContent: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  oldHelmetId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  newNfcContent: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  newHelmetId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  helmetName: Joi.string().trim().min(2).max(64).pattern(SAFE_HELMET_CODE_PATTERN).required(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .or('oldNfcContent', 'oldHelmetId')
  .or('newNfcContent', 'newHelmetId')
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyBikeDeleteDto = Joi.object({
  campId: UUID.allow('', null).optional(),
  bikeRemoveId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyHelmetDeleteDto = Joi.object({
  campId: UUID.allow('', null).optional(),
  bikeRemoveId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  helmetRemoveId: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  code: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).optional(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .or('bikeRemoveId', 'helmetRemoveId', 'code')
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyRentDto = Joi.object({
  campId: UUID.allow('', null).optional(),
  nfcData: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  date: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  time: Joi.string().trim().pattern(/^\d{2}:\d{2}$/).required(),
  selectClient: UUID.required(),
  helmetId: Joi.string().trim().allow('', null).max(128).optional(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const legacyReturnDto = Joi.object({
  campId: UUID.allow('', null).optional(),
  nfcData: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  date: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  time: Joi.string().trim().pattern(/^\d{2}:\d{2}$/).required(),
  helmetId: Joi.string().trim().allow('', null).max(128).optional(),
  username: Joi.string().trim().allow('', null).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

module.exports = {
  assignmentsQueryDto,
  bicycleAddDto,
  bicycleDeleteDto,
  bicycleEditDto,
  campQueryDto,
  helmetAddDto,
  helmetDeleteDto,
  helmetEditDto,
  listQueryDto,
  legacyBikeAddDto,
  legacyBikeDeleteDto,
  legacyBikeEditDto,
  legacyCheckBikeQueryDto,
  legacyHelmetAddDto,
  legacyHelmetDeleteDto,
  legacyHelmetEditDto,
  legacyNfcLookupQueryDto,
  legacyRentDto,
  legacyReturnDto,
  nfcLookupQueryDto,
  rentalCreateDto,
  rentalReturnDto,
  rentalsQueryDto,
};
