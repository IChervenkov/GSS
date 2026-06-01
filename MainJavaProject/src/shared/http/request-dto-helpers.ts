const Joi = require('joi');

function strictDto(schema) {
  return schema.required().unknown(false).prefs({ abortEarly: true, convert: true, stripUnknown: true });
}

const emptyBodyRequestDto = Joi.object({})
  .default({})
  .unknown(false)
  .prefs({ abortEarly: true, convert: true, stripUnknown: true });

module.exports = {
  strictDto,
  emptyBodyRequestDto,
};
