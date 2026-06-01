const fs = require('fs');
const dotenv = require('dotenv');
const Joi = require('joi');
const path = require('path');

const DEPRECATED_ENV_ALIASES = Object.freeze({
  REDIS_URL: 'Use REDIS_HOST and REDIS_PORT.',
  REDIS_URI: 'Use REDIS_HOST and REDIS_PORT.',
  TOKEN_EXPIRES_IN: 'Use ACCESS_TOKEN_EXPIRES_IN and REFRESH_TOKEN_EXPIRES_IN.',
  ACCESS_TOKEN_TTL_MINUTES: 'Use ACCESS_TOKEN_EXPIRES_IN.',
  REFRESH_TOKEN_TTL_DAYS: 'Use REFRESH_TOKEN_EXPIRES_IN.',
  JWT_SECRET: 'Use ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET.',
  SESSION_REDIS_URL: 'Use REDIS_HOST, REDIS_PORT, and SESSION_REDIS_PREFIX.',
});

const PLACEHOLDER_SECRET_MARKERS = Object.freeze([
  'changeme',
  'replace-me',
  'example',
  'placeholder',
  'your-secret-here',
]);

function loadEnvironmentFiles() {
  const candidates = [process.env.ENV_FILE, path.join(process.cwd(), '.env')].filter(Boolean);

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    dotenv.config({ path: candidate, override: false, quiet: true });
    break;
  }
}

function optionalStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNodeEnv(value) {
  return value === 'dev' ? 'development' : value;
}

function normalizeEnvironmentName(value) {
  return value === 'development' ? 'dev' : value;
}

function findConfiguredDeprecatedAliases(source) {
  return Object.entries(DEPRECATED_ENV_ALIASES).filter(([name]) => {
    const value = source[name];
    return value != null && String(value).trim() !== '';
  });
}

function assertNoDeprecatedAliases(source) {
  const configured = findConfiguredDeprecatedAliases(source);
  if (!configured.length) return;

  const lines = configured.map(([name, replacement]) => `${name} is deprecated. ${replacement}`);
  throw new Error(lines.join('\n'));
}

function ensureMatchingEnvironmentSelectors(source) {
  const nodeEnv = normalizeNodeEnv(
    String(source.NODE_ENV || 'development')
      .trim()
      .toLowerCase(),
  );
  const environmentName = normalizeEnvironmentName(
    String(source.ENVIRONMENT_NAME || nodeEnv)
      .trim()
      .toLowerCase(),
  );

  if (environmentName && nodeEnv && environmentName !== normalizeEnvironmentName(nodeEnv)) {
    throw new Error('NODE_ENV and ENVIRONMENT_NAME must refer to the same environment.');
  }
}

function ensureNotPlaceholder(name, value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    throw new Error(`${name} must not be empty.`);
  }
  if (PLACEHOLDER_SECRET_MARKERS.some((item) => normalized.includes(item))) {
    throw new Error(`${name} must be a real secret and not a placeholder.`);
  }
}

function secretStringSchema(name) {
  return Joi.string()
    .custom((value, helpers) => {
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (PLACEHOLDER_SECRET_MARKERS.some((item) => normalized.includes(item))) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'placeholder secret validation')
    .min(32)
    .messages({
      'any.invalid': `${name} must be a real secret and not a placeholder.`,
    })
    .required();
}

loadEnvironmentFiles();
assertNoDeprecatedAliases(process.env);
ensureMatchingEnvironmentSelectors(process.env);

const schema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('local', 'development', 'dev', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  APP_NAME: Joi.string().min(1).max(64).required(),
  APP_URL: Joi.string().uri().required(),
  APP_VERSION: Joi.string().default('1.0.0'),
  APP_BUILD_SHA: Joi.string().allow('').default(''),
  APP_BUILD_TIME: Joi.string().allow('').default(''),
  ENVIRONMENT_NAME: Joi.string()
    .valid('local', 'dev', 'staging', 'production', 'test')
    .default(Joi.ref('NODE_ENV')),

  SESSION_SECRET: secretStringSchema('SESSION_SECRET'),
  ACCESS_TOKEN_SECRET: secretStringSchema('ACCESS_TOKEN_SECRET'),
  REFRESH_TOKEN_SECRET: secretStringSchema('REFRESH_TOKEN_SECRET'),
  ACCESS_TOKEN_EXPIRES_IN: Joi.number().integer().min(1).max(30).default(15),
  REFRESH_TOKEN_EXPIRES_IN: Joi.number().integer().min(1).max(90).default(14),
  ACCESS_TOKEN_ISSUER: Joi.string().allow('').default(''),
  ACCESS_TOKEN_AUDIENCE: Joi.string().allow('').default(''),
  REFRESH_SESSION_MAX_ACTIVE_PER_USER: Joi.number().integer().min(1).max(50).default(10),
  REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE: Joi.number().integer().min(1).max(20).default(3),

  DB_USER: Joi.string(),
  DB_HOST: Joi.string(),
  DB_NAME: Joi.string(),
  DB_PASSWORD: Joi.string(),
  DB_PORT: Joi.number().port(),

  DATABASE_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_MAX_CLIENTS: Joi.number().integer().min(1).default(20),
  DATABASE_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  DATABASE_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),

  DB_RUN_MIGRATIONS_ON_BOOT: Joi.boolean().truthy('true').falsy('false').default(false),
  ALLOW_RUNTIME_MIGRATIONS: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_RUN_MAINTENANCE_ON_BOOT: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_MAINTENANCE_INITIAL_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .default(60 * 1000),
  DB_MAINTENANCE_INTERVAL_MS: Joi.number()
    .integer()
    .min(60000)
    .default(5 * 60 * 1000),
  DB_FAILED_LOGINS_RETENTION_DAYS: Joi.number().integer().min(1).default(7),
  DB_AUDIT_ARCHIVE_AFTER_DAYS: Joi.number().integer().min(30).default(180),

  HASH_APP_BIKE: secretStringSchema('HASH_APP_BIKE'),
  HASH_APP_LAUNDRY: secretStringSchema('HASH_APP_LAUNDRY'),
  HASH_APP_ASSET: secretStringSchema('HASH_APP_ASSET'),
  HASH_APP_GYM: secretStringSchema('HASH_APP_GYM'),
  APP_BIKE_VERSION: Joi.string().trim().min(1).default('1.4.1'),
  APP_LAUNDRY_VERSION: Joi.string().trim().min(1).default('1.4.2'),
  APP_ASSET_VERSION: Joi.string().trim().min(1).default('1.5.3'),
  APP_BIKE_FILE_PATH: Joi.string().min(1).default('androidApp/gss-bike-1.4.1-release.apk'),
  APP_LAUNDRY_FILE_PATH: Joi.string()
    .min(1)
    .default('androidApp/gss-laundry-1.4.2-release.apk'),
  APP_ASSET_FILE_PATH: Joi.string()
    .min(1)
    .default('androidApp/gss-asset-1.5.3-release.apk'),

  REDIS_HOST: Joi.string().allow('').default(''),
  REDIS_PORT: Joi.alternatives().try(Joi.number().port(), Joi.string().allow('')).default(''),
  REDIS_REQUIRED: Joi.boolean().truthy('true').falsy('false').default(false),
  SESSION_REDIS_PREFIX: Joi.string().min(1).default('sess:'),

  SECRET_NAME: Joi.string().min(1).max(64).required(),
  SESSION_SECRET_PREVIOUS: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.array().items(Joi.string().min(32)))
    .default([]),
  SESSION_TTL_MS: Joi.number()
    .integer()
    .min(60000)
    .default(8 * 60 * 60 * 1000),
  SESSION_ABSOLUTE_TTL_MS: Joi.number()
    .integer()
    .min(60000)
    .default(24 * 60 * 60 * 1000),
  SESSION_COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').optional(),
  SESSION_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  SESSION_COOKIE_DOMAIN: Joi.string().allow('').default(''),
  SESSION_COOKIE_PATH: Joi.string().min(1).default('/'),

  CSP_REPORT_ONLY: Joi.boolean().truthy('true').falsy('false').default(false),

  LOGIN_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(15 * 60 * 1000),
  LOGIN_RATE_LIMIT_MAX_BY_IP: Joi.number().integer().min(1).default(20),
  LOGIN_RATE_LIMIT_MAX_BY_USERNAME: Joi.number().integer().min(1).default(10),

  QR_REQUEST_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(5 * 60 * 1000),
  QR_REQUEST_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(3),

  PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(15 * 60 * 1000),
  PASSWORD_CHANGE_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(5),

  API_RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(60 * 1000),
  API_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(120),

  SECURITY_UPLOAD_MAX_FILE_SIZE: Joi.number()
    .integer()
    .min(1024)
    .default(10 * 1024 * 1024),
  TWO_FACTOR_ENROLLMENT_TTL_SECONDS: Joi.number()
    .integer()
    .min(30)
    .default(10 * 60),
  ONE_TIME_QR_TTL_SECONDS: Joi.number().integer().min(10).default(30),

  ADMIN_USERNAME: Joi.string().required(),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  TRUST_PROXY: Joi.alternatives()
    .try(Joi.boolean(), Joi.number().integer().min(0), Joi.string().min(1))
    .default(false),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  OBSERVABILITY_METRICS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OBSERVABILITY_METRICS_AUTH_TOKEN: Joi.string().allow('').default(''),
  OBSERVABILITY_HEALTH_AUTH_TOKEN: Joi.string().allow('').default(''),
  OBSERVABILITY_INSTANCE: Joi.string().allow('').default(''),

  GRACEFUL_SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  CONNECTION_DRAIN_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  KEEP_ALIVE_TIMEOUT_MS: Joi.number().integer().min(1000).default(65000),
  HEADERS_TIMEOUT_MS: Joi.number().integer().min(1000).default(66000),

  BACKUP_S3_BUCKET: Joi.string().allow('').default(''),
  DB_MIGRATION_GATE_TOKEN: Joi.string().allow('').default(''),
  DB_MIGRATION_RELEASE_ID: Joi.string().allow('').default(''),
  DB_MIGRATION_APPLIED_BY: Joi.string().allow('').default(''),
  BACKUP_RETENTION_DAYS: Joi.number().integer().min(1).default(14),
  RPO_MINUTES: Joi.number().integer().min(1).default(15),
  RTO_MINUTES: Joi.number().integer().min(1).default(60),
})
  .required()
  .unknown(true)
  .prefs({ abortEarly: false, convert: true, stripUnknown: true });

const { value, error } = schema.validate(process.env);
if (error) throw new Error(error.details.map((d) => d.message).join('\n'));

const resolved = {
  ...value,
  SESSION_SECRET_PREVIOUS: optionalStringArray(value.SESSION_SECRET_PREVIOUS),
};

resolved.NODE_ENV = normalizeNodeEnv(resolved.NODE_ENV);
resolved.ENVIRONMENT_NAME = normalizeEnvironmentName(resolved.ENVIRONMENT_NAME);
if (resolved.REDIS_PORT === '') resolved.REDIS_PORT = null;

for (const key of ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT']) {
  if (!resolved[key]) {
    throw new Error(`${key} is required`);
  }
}

if (Boolean(resolved.REDIS_HOST) !== Boolean(resolved.REDIS_PORT)) {
  throw new Error('REDIS_HOST and REDIS_PORT must either both be set or both be empty.');
}

const isProdLike = ['production', 'staging'].includes(resolved.NODE_ENV);
const isLocal = resolved.NODE_ENV === 'local' || resolved.ENVIRONMENT_NAME === 'local';

if (!isLocal) {
  for (const secretKey of [
    'SESSION_SECRET',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'DB_PASSWORD',
    'HASH_APP_BIKE',
    'HASH_APP_LAUNDRY',
    'HASH_APP_ASSET',
    'HASH_APP_GYM',
  ]) {
    ensureNotPlaceholder(secretKey, resolved[secretKey]);
  }

  for (const rotatedSecret of resolved.SESSION_SECRET_PREVIOUS) {
    ensureNotPlaceholder('SESSION_SECRET_PREVIOUS', rotatedSecret);
  }

  for (const optionalSecretKey of [
    'OBSERVABILITY_METRICS_AUTH_TOKEN',
    'OBSERVABILITY_HEALTH_AUTH_TOKEN',
  ]) {
    if (resolved[optionalSecretKey]) {
      ensureNotPlaceholder(optionalSecretKey, resolved[optionalSecretKey]);
    }
  }
}

if (isProdLike) {
  if (!/^https:\/\//i.test(resolved.APP_URL)) {
    throw new Error('APP_URL must use https in staging and production.');
  }
  if (!resolved.REDIS_HOST || !resolved.REDIS_PORT) {
    throw new Error('REDIS_HOST and REDIS_PORT are required in staging and production.');
  }
  if (!resolved.OBSERVABILITY_METRICS_AUTH_TOKEN || !resolved.OBSERVABILITY_HEALTH_AUTH_TOKEN) {
    throw new Error('Observability auth tokens are required in staging and production.');
  }
  if (resolved.DB_RUN_MIGRATIONS_ON_BOOT && !resolved.ALLOW_RUNTIME_MIGRATIONS) {
    throw new Error(
      'DB_RUN_MIGRATIONS_ON_BOOT is disabled by policy in staging and production unless ALLOW_RUNTIME_MIGRATIONS=true.',
    );
  }
  if (resolved.DB_RUN_MIGRATIONS_ON_BOOT && !resolved.DB_MIGRATION_GATE_TOKEN) {
    throw new Error(
      'DB_MIGRATION_GATE_TOKEN is required when runtime migrations are enabled in staging and production.',
    );
  }
}

const startupSummary = Object.freeze({
  environment: resolved.ENVIRONMENT_NAME,
  nodeEnv: resolved.NODE_ENV,
  version: resolved.APP_VERSION,
  buildSha: resolved.APP_BUILD_SHA || 'unknown',
  dbSslEnabled: Boolean(resolved.DATABASE_SSL),
  redisEnabled: Boolean(resolved.REDIS_HOST && resolved.REDIS_PORT),
  metricsEnabled: Boolean(resolved.OBSERVABILITY_METRICS_ENABLED),
  migrationsEnabled: Boolean(resolved.DB_RUN_MIGRATIONS_ON_BOOT),
  maintenanceEnabled: Boolean(resolved.DB_RUN_MAINTENANCE_ON_BOOT),
});

module.exports = Object.freeze({
  ...resolved,
  isProd: resolved.NODE_ENV === 'production',
  isProdLike,
  isLocal,
  startupSummary,
});
