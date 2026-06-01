const Joi = require('joi');
const { emptyBodyRequestDto } = require('../../../../../shared/http/request-dto-helpers');

const SAFE_ASSET_TEXT_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.:/,\-()]+$/u;
const SAFE_OPTIONAL_TEXT_PATTERN = /^[\p{L}\p{N} _.:/,\-()]*$/u;
const SAFE_ASSET_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:./-]+$/u;
const SAFE_RFID_CODE_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}_:.-]+$/u;
const SAFE_QUANTITY_PATTERN = /^\d+(?:[.,]\d+)?$/;
const SAFE_DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;
const SAFE_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\s?(?:AM|PM))?)?$/i;
const INVENTORY_STATUSES = ['undiscovered', 'completed', 'written_off'];
const ASSET_STATUSES = ['Excellent', 'Good', 'Fair', 'Poor', 'Unacceptable'];
const WAREHOUSES = ['large', 'small'];

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

const assetsDataRequestDto = Joi.object({
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

const assetPayload = {
  code: Joi.string().trim().min(1).max(64).pattern(SAFE_ASSET_CODE_PATTERN).required(),
  rfidCode: Joi.string().trim().allow('', null).max(128).pattern(SAFE_RFID_CODE_PATTERN).optional(),
  name: Joi.string().trim().min(1).max(128).pattern(SAFE_ASSET_TEXT_PATTERN).required(),
  typeId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  locationRoomId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  locationKeyId: Joi.string()
    .allow('', null)
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
  category: Joi.string().trim().allow('', null).max(96).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  quantity: Joi.string().trim().min(1).max(32).pattern(SAFE_QUANTITY_PATTERN).required(),
  owner: Joi.string().trim().allow('', null).max(96).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  status: Joi.string().trim().valid(...ASSET_STATUSES).required(),
  expandable: Joi.string().valid('Expandable', 'Non Expandable', '').default('Non Expandable'),
  description: Joi.string().trim().allow('', null).max(512).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  service: Joi.string().trim().allow('', null).max(96).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  mrah: Joi.string().trim().allow('', null).max(96).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  m2Inside: Joi.string().trim().allow('', null).max(64).pattern(SAFE_DECIMAL_PATTERN).optional(),
  purchaseDate: Joi.string().trim().allow('', null).pattern(SAFE_DATE_TIME_PATTERN).optional(),
  writtenOffDate: Joi.any().optional().strip(),
  purchasePrice: Joi.string().trim().allow('', null).max(64).pattern(SAFE_DECIMAL_PATTERN).optional(),
  lastInventoryDate: Joi.any().optional().strip(),
  comments: Joi.string().trim().allow('', null).max(512).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  replacedOff: Joi.string().trim().allow('', null).max(256).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  replacedBy: Joi.string().trim().allow('', null).max(256).pattern(SAFE_OPTIONAL_TEXT_PATTERN).optional(),
  yearOfLifeCycle: Joi.string().trim().allow('', null).max(64).pattern(SAFE_DECIMAL_PATTERN).optional(),
  restOfLifeCycle: Joi.string().trim().allow('', null).max(64).pattern(SAFE_DECIMAL_PATTERN).optional(),
  restValue: Joi.string().trim().allow('', null).max(64).pattern(SAFE_DECIMAL_PATTERN).optional(),
  inventoryStatus: Joi.string().valid(...INVENTORY_STATUSES).default('undiscovered'),
  isFixed: Joi.boolean().strict().default(false),
  isQuantitative: Joi.boolean().strict().default(false),
};

const assetAddRequestDto = Joi.object(assetPayload)
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetEditRequestDto = Joi.object({
  assetId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  ...assetPayload,
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetDeleteRequestDto = Joi.object({
  assetId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetBulkUpdateRequestDto = Joi.object({
  payload: Joi.string().trim().min(1).max(100000).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetTypeAddRequestDto = Joi.object({
  name: Joi.string().trim().min(1).max(96).pattern(SAFE_ASSET_TEXT_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetTypeEditRequestDto = Joi.object({
  typeId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  name: Joi.string().trim().min(1).max(96).pattern(SAFE_ASSET_TEXT_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetTypeDeleteRequestDto = Joi.object({
  typeId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetTypeBulkUpdateRequestDto = Joi.object({
  payload: Joi.string().trim().min(1).max(50000).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const cleanItemPayload = {
  itemName: Joi.string().trim().min(1).max(128).pattern(SAFE_ASSET_TEXT_PATTERN).required(),
  totalAmount: Joi.number().min(0).max(100000000).required(),
  countGetItem: Joi.number().min(0).max(100000000).default(0),
  warehouse: Joi.string().valid(...WAREHOUSES).default('large'),
};

const cleanItemAddRequestDto = Joi.object(cleanItemPayload)
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const cleanItemEditRequestDto = Joi.object({
  itemId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  ...cleanItemPayload,
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const cleanItemDeleteRequestDto = Joi.object({
  itemId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const cleanItemMoveRequestDto = Joi.object({
  itemId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  warehouse: Joi.string().valid(...WAREHOUSES).required(),
  quantity: Joi.number().integer().min(1).max(100000000).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const cleanItemBulkUpdateRequestDto = Joi.object({
  payload: Joi.string().trim().min(1).max(50000).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const assetRestartInventoryRequestDto = emptyBodyRequestDto;
const assetImportRequestDto = emptyBodyRequestDto;

module.exports = {
  assetAddRequestDto,
  assetBulkUpdateRequestDto,
  assetDeleteRequestDto,
  assetEditRequestDto,
  assetImportRequestDto,
  assetRestartInventoryRequestDto,
  assetTypeAddRequestDto,
  assetTypeBulkUpdateRequestDto,
  assetTypeDeleteRequestDto,
  assetTypeEditRequestDto,
  assetsDataRequestDto,
  cleanItemAddRequestDto,
  cleanItemBulkUpdateRequestDto,
  cleanItemDeleteRequestDto,
  cleanItemEditRequestDto,
  cleanItemMoveRequestDto,
};
