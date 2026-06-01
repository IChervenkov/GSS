const Joi = require('joi');
const { emptyBodyRequestDto } = require('../../../../../shared/http/request-dto-helpers');

const SAFE_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.:/-]+$/u;
const SAFE_NFC_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

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

function isValidDateOnly(value) {
  const match = ISO_DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const uuidField = () =>
  Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required();

const optionalUuidField = () =>
  Joi.string()
    .trim()
    .allow('', null)
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional();

const optionalDateField = () =>
  Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (value === '' || value === null) return value;
      if (isValidDateOnly(value)) return value;
      return helpers.error('date.format');
    })
    .messages({ 'date.format': '{{#label}} must be a valid date in YYYY-MM-DD format' })
    .allow('', null)
    .optional();

const buildingAddRequestDto = Joi.object({
  name: Joi.string().trim().min(1).max(96).pattern(SAFE_NAME_PATTERN).required(),
  type: Joi.string().trim().allow('').max(64).pattern(SAFE_NAME_PATTERN).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const buildingEditRequestDto = Joi.object({
  buildingId: uuidField(),
  name: Joi.string().trim().min(1).max(96).pattern(SAFE_NAME_PATTERN).required(),
  type: Joi.string().trim().allow('').max(64).pattern(SAFE_NAME_PATTERN).optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const buildingDeleteRequestDto = Joi.object({
  buildingId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const roomAddRequestDto = Joi.object({
  name: Joi.string().trim().min(1).max(96).pattern(SAFE_NAME_PATTERN).required(),
  buildingId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const roomEditRequestDto = Joi.object({
  roomId: uuidField(),
  name: Joi.string().trim().min(1).max(96).pattern(SAFE_NAME_PATTERN).required(),
  buildingId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const roomDeleteRequestDto = Joi.object({
  roomId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const keyAddRequestDto = Joi.object({
  name: Joi.string().trim().min(1).max(128).pattern(SAFE_NAME_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  roomId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const keyEditRequestDto = Joi.object({
  keyId: uuidField(),
  name: Joi.string().trim().min(1).max(128).pattern(SAFE_NAME_PATTERN).required(),
  nfcCode: Joi.string().trim().min(2).max(128).pattern(SAFE_NFC_CODE_PATTERN).required(),
  roomId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const keyDeleteRequestDto = Joi.object({
  keyId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const keyIssueRequestDto = Joi.object({
  keyId: uuidField(),
  soldierId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const keyReleaseRequestDto = Joi.object({
  keyId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const soldierAddRequestDto = Joi.object({
  name: Joi.string().trim().min(1).max(128).pattern(SAFE_NAME_PATTERN).required(),
  country: Joi.string().trim().allow('').max(96).pattern(SAFE_NAME_PATTERN).optional(),
  mealCard: Joi.string().trim().allow('').max(96).pattern(SAFE_NAME_PATTERN).optional(),
  laundryBagId: optionalUuidField(),
  upcomingAccommodation: optionalDateField(),
  upcomingRelease: optionalDateField(),
  upcomingAccommodationKey: optionalUuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const soldierEditRequestDto = soldierAddRequestDto.keys({
  soldierId: uuidField(),
});

const soldierDeleteRequestDto = Joi.object({
  soldierId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const soldierAccommodationRequestDto = Joi.object({
  soldierId: uuidField(),
  keyId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const soldierMoveRequestDto = Joi.object({
  soldierId: uuidField(),
  keyId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
  keyIds: Joi.array().items(uuidField()).min(1).max(50).optional(),
})
  .xor('keyId', 'keyIds')
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const multipleSoldierAccommodationRequestDto = Joi.object({
  assignments: Joi.array()
    .items(
      Joi.object({
        soldierId: uuidField(),
        keyId: uuidField(),
      })
        .required()
        .unknown(false),
    )
    .min(1)
    .max(200)
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const soldierDischargeRequestDto = Joi.object({
  soldierId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const multipleRoomReleaseRequestDto = Joi.object({
  roomIds: Joi.array().items(uuidField()).min(1).max(200).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const multipleBuildingReleaseRequestDto = Joi.object({
  buildingIds: Joi.array().items(uuidField()).min(1).max(200).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const soldierSwapRequestDto = Joi.object({
  soldierId: uuidField(),
  targetSoldierId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const additionalItemAddRequestDto = Joi.object({
  soldierId: uuidField(),
  description: Joi.string().trim().min(1).max(160).pattern(SAFE_NAME_PATTERN).required(),
  quantity: Joi.string().trim().allow('').max(64).pattern(POSITIVE_INTEGER_PATTERN).optional(),
  laundryBagId: optionalUuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const additionalItemEditRequestDto = additionalItemAddRequestDto.keys({
  itemId: uuidField(),
});

const additionalItemDeleteRequestDto = Joi.object({
  itemId: uuidField(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const buildingImportRequestDto = emptyBodyRequestDto;
const roomImportRequestDto = emptyBodyRequestDto;
const keyImportRequestDto = emptyBodyRequestDto;
const soldierImportRequestDto = emptyBodyRequestDto;
const additionalItemImportRequestDto = emptyBodyRequestDto;

const accommodationDataRequestDto = Joi.object({
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

const accommodationLookupRequestDto = Joi.object({
  type: Joi.string().valid('building', 'room', 'soldier', 'laundryBag', 'key').required(),
  search: Joi.string().trim().allow('').max(128).default(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
  onlyFree: Joi.boolean().default(false),
  onlyOccupied: Joi.boolean().default(false),
  excludedSoldierId: optionalUuidField(),
  excludedKeyIds: Joi.string().trim().allow('').max(4000).default(''),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const accommodationReportDownloadRequestDto = Joi.object({
  section: Joi.string().valid('all', 'check', 'move', 'items').default('all'),
  fromDate: optionalDateField(),
  toDate: optionalDateField(),
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

module.exports = {
  accommodationDataRequestDto,
  accommodationLookupRequestDto,
  accommodationReportDownloadRequestDto,
  additionalItemAddRequestDto,
  additionalItemDeleteRequestDto,
  additionalItemEditRequestDto,
  additionalItemImportRequestDto,
  buildingAddRequestDto,
  buildingDeleteRequestDto,
  buildingEditRequestDto,
  buildingImportRequestDto,
  keyAddRequestDto,
  keyDeleteRequestDto,
  keyEditRequestDto,
  keyImportRequestDto,
  keyIssueRequestDto,
  keyReleaseRequestDto,
  multipleBuildingReleaseRequestDto,
  multipleRoomReleaseRequestDto,
  multipleSoldierAccommodationRequestDto,
  roomAddRequestDto,
  roomDeleteRequestDto,
  roomEditRequestDto,
  roomImportRequestDto,
  soldierAccommodationRequestDto,
  soldierAddRequestDto,
  soldierDeleteRequestDto,
  soldierDischargeRequestDto,
  soldierEditRequestDto,
  soldierImportRequestDto,
  soldierMoveRequestDto,
  soldierSwapRequestDto,
};
