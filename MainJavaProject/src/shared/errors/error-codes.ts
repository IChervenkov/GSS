const { ERROR_DEFINITIONS } = require('./error-catalog');

const ERROR_CODES = Object.freeze(
  Object.fromEntries(ERROR_DEFINITIONS.map((definition) => [definition.code, definition.code])),
);

module.exports = { ERROR_CODES };
