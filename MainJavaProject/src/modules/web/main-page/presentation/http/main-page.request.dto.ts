const Joi = require('joi');
const { emptyBodyRequestDto } = require('../../../../../shared/http/request-dto-helpers');

const SAFE_STRING_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} _.-]+$/u;
const SAFE_SEARCH_PATTERN = /^(?!\s)(?!.*\s{2,})[\p{L}\p{N} _.@+-]+(?<!\s)$/u;
const SAFE_USER_PATTERN = /^(?=.{3,32}$)[\p{L}\p{N}][\p{L}\p{N}_.@+-]*[\p{L}\p{N}]$/u;
const SAFE_PASSWORD_PATTERN =
  /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[ -~]+$/;

const CAMP_LIST_COLUMNS = Object.freeze(['name', 'id']);
const CAMP_SORT_COLUMNS = Object.freeze(['name', 'id']);
const USER_LIST_COLUMNS = Object.freeze(['username', 'account', 'status']);
const USER_SORT_COLUMNS = Object.freeze(['username', 'account', 'status', 'user_confirmation']);
const PERMISSION_COLUMNS = Object.freeze(['name']);
const CAMP_ACCESS_COLUMNS = Object.freeze(['name', 'id']);
const SORT_DIRECTIONS = Object.freeze(['desc', 'asc', 'default']);
const USER_MESSAGE_TYPES = Object.freeze(['suggestion', 'message', 'issue', 'other']);
const ADMIN_INBOX_COLUMNS = Object.freeze(['type', 'username', 'subject', 'status', 'createdAt']);

function arrayOrSingle(schema) {
  return Joi.alternatives()
    .try(schema, Joi.array().items(schema).max(20))
    .custom((value) => {
      if (Array.isArray(value)) {
        return value;
      }

      if (value === undefined || value === null) {
        return [];
      }

      return [value];
    });
}

function withSearchPairing(schema) {
  return schema
    .custom((value, helpers) => {
      const hasSearchColumn = value.searchColumn !== undefined;
      const hasSearchValue = value.searchValue !== undefined;

      if (hasSearchColumn !== hasSearchValue) {
        return helpers.error('any.invalid', {
          message: 'searchColumn and searchValue must be provided together',
        });
      }

      const columnLength = Array.isArray(value.searchColumn)
        ? value.searchColumn.length
        : hasSearchColumn
          ? 1
          : 0;
      const valueLength = Array.isArray(value.searchValue)
        ? value.searchValue.length
        : hasSearchValue
          ? 1
          : 0;

      if (columnLength !== valueLength) {
        return helpers.error('any.invalid', {
          message: 'searchColumn and searchValue length mismatch',
        });
      }

      return value;
    })
    .required()
    .unknown(false)
    .prefs({ abortEarly: true, convert: true, stripUnknown: true });
}

const campsDataRequestDto = withSearchPairing(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    searchColumn: arrayOrSingle(Joi.string().valid(...CAMP_LIST_COLUMNS)).optional(),
    searchValue: arrayOrSingle(Joi.string().trim().pattern(SAFE_SEARCH_PATTERN)).optional(),
    sortColumn: Joi.string()
      .valid(...CAMP_SORT_COLUMNS)
      .optional(),
    sortDirection: Joi.string()
      .valid(...SORT_DIRECTIONS)
      .default('default'),
  }),
);

const campChangeRequestDto = Joi.object({
  campId: Joi.alternatives()
    .try(
      Joi.string().uuid({ version: ['uuidv4', 'uuidv5'] }),
      Joi.string().allow(''),
      Joi.valid(null),
    )
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const campAddRequestDto = Joi.object({
  campName: Joi.string().trim().min(2).max(64).pattern(SAFE_STRING_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const campEditRequestDto = Joi.object({
  campId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  campName: Joi.string().trim().min(2).max(64).pattern(SAFE_STRING_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const campDeleteRequestDto = Joi.object({
  campId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const permissionsDataRequestDto = withSearchPairing(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    searchColumn: arrayOrSingle(Joi.string().valid(...PERMISSION_COLUMNS)).optional(),
    searchValue: arrayOrSingle(Joi.string().trim().pattern(SAFE_SEARCH_PATTERN)).optional(),
    sortColumn: Joi.string()
      .valid(...PERMISSION_COLUMNS)
      .optional(),
    sortDirection: Joi.string()
      .valid(...SORT_DIRECTIONS)
      .default('default'),
  }),
);

const permissionsSaveRequestDto = Joi.object({
  permissions: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string()
          .uuid({ version: ['uuidv4', 'uuidv5'] })
          .required(),
        permId: Joi.string()
          .uuid({ version: ['uuidv4', 'uuidv5'] })
          .required(),
        isCheck: Joi.boolean().strict().required(),
      })
        .required()
        .unknown(false),
    )
    .min(1)
    .max(1000)
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const campAccessDataRequestDto = withSearchPairing(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    searchColumn: arrayOrSingle(Joi.string().valid(...CAMP_ACCESS_COLUMNS)).optional(),
    searchValue: arrayOrSingle(Joi.string().trim().pattern(SAFE_SEARCH_PATTERN)).optional(),
    sortColumn: Joi.string()
      .valid(...CAMP_ACCESS_COLUMNS)
      .optional(),
    sortDirection: Joi.string()
      .valid(...SORT_DIRECTIONS)
      .default('default'),
  }),
);

const campAccessSaveRequestDto = Joi.object({
  campAccess: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string()
          .uuid({ version: ['uuidv4', 'uuidv5'] })
          .required(),
        campId: Joi.string()
          .uuid({ version: ['uuidv4', 'uuidv5'] })
          .required(),
        isCheck: Joi.boolean().strict().required(),
      })
        .required()
        .unknown(false),
    )
    .min(1)
    .max(1000)
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const usersDataRequestDto = withSearchPairing(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    searchColumn: arrayOrSingle(Joi.string().valid(...USER_LIST_COLUMNS)).optional(),
    searchValue: arrayOrSingle(Joi.string().pattern(SAFE_SEARCH_PATTERN)).optional(),
    sortColumn: Joi.string()
      .valid(...USER_SORT_COLUMNS)
      .optional(),
    sortDirection: Joi.string()
      .valid(...SORT_DIRECTIONS)
      .default('default'),
  }),
);

const addUserRequestDto = Joi.object({
  username: Joi.string().trim().min(3).max(32).pattern(SAFE_USER_PATTERN).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const editUserRequestDto = Joi.object({
  id: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  username: Joi.string().trim().min(3).max(32).pattern(SAFE_USER_PATTERN).required(),
  password: Joi.string().allow('').pattern(SAFE_PASSWORD_PATTERN).max(256).optional(),
  locked: Joi.boolean().strict().optional(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const deleteUserRequestDto = Joi.object({
  codes: Joi.array()
    .items(
      Joi.string()
        .uuid({ version: ['uuidv4', 'uuidv5'] })
        .required(),
    )
    .min(1)
    .max(100)
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });


const securityResetUserRequestDto = Joi.object({
  userId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const resolveUserRequestDto = Joi.object({
  requestId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  decision: Joi.string().valid('approved', 'denied').required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const submitUserMessageRequestDto = Joi.object({
  type: Joi.string()
    .valid(...USER_MESSAGE_TYPES)
    .default('suggestion'),
  subject: Joi.string().trim().min(2).max(120).required(),
  message: Joi.string().trim().min(10).max(2000).required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const adminInboxRequestDto = withSearchPairing(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    searchColumn: arrayOrSingle(Joi.string().valid(...ADMIN_INBOX_COLUMNS)).optional(),
    searchValue: arrayOrSingle(Joi.string().trim().pattern(SAFE_SEARCH_PATTERN)).optional(),
    sortColumn: Joi.string()
      .valid(...ADMIN_INBOX_COLUMNS)
      .optional(),
    sortDirection: Joi.string()
      .valid(...SORT_DIRECTIONS)
      .default('default'),
  }),
);

const updateUserMessageStatusRequestDto = Joi.object({
  messageId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  status: Joi.string().valid('open', 'closed').required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

const deleteAdminInboxItemRequestDto = Joi.object({
  itemId: Joi.string()
    .uuid({ version: ['uuidv4', 'uuidv5'] })
    .required(),
  itemKind: Joi.string().valid('user_message', 'access_request').required(),
})
  .required()
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });


const campImportRequestDto = emptyBodyRequestDto;
const logoutRequestDto = emptyBodyRequestDto;

module.exports = {
  campsDataRequestDto,
  campChangeRequestDto,
  campAddRequestDto,
  campEditRequestDto,
  campImportRequestDto,
  campDeleteRequestDto,
  permissionsDataRequestDto,
  permissionsSaveRequestDto,
  campAccessDataRequestDto,
  campAccessSaveRequestDto,
  usersDataRequestDto,
  addUserRequestDto,
  editUserRequestDto,
  deleteUserRequestDto,
  securityResetUserRequestDto,
  resolveUserRequestDto,
  submitUserMessageRequestDto,
  adminInboxRequestDto,
  updateUserMessageStatusRequestDto,
  deleteAdminInboxItemRequestDto,
  logoutRequestDto,
};
