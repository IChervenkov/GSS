# Deployment and infrastructure runbook

## Environment model

- local: docker-compose on a developer machine.
- dev: shared integration environment for active development.
- staging: production-like validation with isolated database, Redis, secrets, and metrics tokens.
- production: customer-facing environment with independent credentials and infrastructure.

Never share a database or secret bundle across environments.

## Configuration governance

- `src/core/config/env.ts` is the only authoritative runtime schema.
- Canonical names only. Deprecated aliases such as `REDIS_URL`, `REDIS_URI`, `TOKEN_EXPIRES_IN`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `JWT_SECRET`, and `SESSION_REDIS_URL` must not be set.
- `NODE_ENV` and `ENVIRONMENT_NAME` must refer to the same environment.
- `REDIS_HOST` and `REDIS_PORT` must either both be set or both be empty.
- Non-local environments must not use placeholder secrets.
- Staging and production require HTTPS `APP_URL`, Redis, and observability auth tokens.
- Startup logs emit a safe config summary only: environment, version, build SHA, DB SSL, Redis enabled, metrics enabled, migrations enabled, and maintenance enabled.

## Deployment contract

1. Build immutable container image.
2. Run lint, unit, integration, and end-to-end tests.
3. Run migration gate against the target environment before traffic shifts.
   - CI uses `.github/workflows/ci-cd.yml` to run the staging gate on the target host with the candidate image before deploy.
   - Manual gated runs use `.github/workflows/migration-gate.yml`.
4. Deploy with start-first strategy.
5. Verify `/health/ready`.
6. Keep previous image tag for rollback.
7. Roll back immediately if readiness, smoke checks, or key flows fail.

## Migration compatibility rules

- Only additive or backward-compatible migrations may ship with an app version that is still serving traffic.
- Destructive changes require at least two deployments:
  1. deploy code that tolerates both schemas
  2. deploy cleanup migration after old code is drained
- Do not edit applied migration files. Add a new forward migration instead.

## Secret management discipline

- Secrets live in the deployment platform secret store, never in git.
- Rotate session, token, DB, and Redis credentials on a schedule and on any suspected leak.
- Use separate credentials per environment.
- Use least-privilege DB roles for runtime, migrations, and backup jobs.

## Rollback path

- Store the last known good image tag on the server as `.previous-successful-image-tag`.
- A rollback re-points the compose deployment to that tag and re-runs `docker compose up -d`.
- Rollback is valid only for backward-compatible migrations.

## Low-downtime behavior

- Readiness flips to degraded during shutdown.
- HTTP server stops accepting new connections before forced drain.
- Open sockets are given a drain window before termination.
- Socket.IO clients must reconnect with exponential backoff and token refresh support.

## Backup and restore targets

- RPO: 15 minutes.
- RTO: 60 minutes.
- Daily full backup plus WAL/incremental archiving is preferred.
- Perform a restore drill at least monthly.

## Environment variable catalog

### Runtime identity

- `NODE_ENV`: runtime mode. Allowed values: `local`, `development`/`dev`, `test`, `staging`, `production`.
- `ENVIRONMENT_NAME`: deployment label used in logs and operational checks. Must match `NODE_ENV` semantically.
- `PORT`: HTTP port.
- `APP_NAME`: service name used in logs and metrics.
- `APP_URL`: canonical external URL.
- `APP_VERSION`: application version.
- `APP_BUILD_SHA`: build commit SHA.
- `APP_BUILD_TIME`: build timestamp in ISO-8601.

### Auth and session

- `SESSION_SECRET`: current session signing secret.
- `SESSION_SECRET_PREVIOUS`: comma-separated previous session secrets during rotation.
- `ACCESS_TOKEN_SECRET`: access JWT signing secret.
- `REFRESH_TOKEN_SECRET`: refresh JWT signing secret.
- `SECRET_NAME`: logical secret bundle name.
- `CSP_REPORT_ONLY`: whether CSP runs in report-only mode.
- `ACCESS_TOKEN_EXPIRES_IN`: access token TTL in minutes.
- `REFRESH_TOKEN_EXPIRES_IN`: refresh token TTL in days.
- `ACCESS_TOKEN_ISSUER`: optional JWT issuer.
- `ACCESS_TOKEN_AUDIENCE`: optional JWT audience.
- `REFRESH_SESSION_MAX_ACTIVE_PER_USER`: per-user refresh session cap.
- `REFRESH_SESSION_MAX_ACTIVE_PER_DEVICE`: per-device refresh session cap.
- `SESSION_TTL_MS`: idle session TTL in milliseconds.
- `SESSION_ABSOLUTE_TTL_MS`: absolute session TTL in milliseconds.
- `SESSION_COOKIE_SECURE`: secure cookie override.
- `SESSION_COOKIE_SAME_SITE`: cookie same-site policy.
- `SESSION_COOKIE_DOMAIN`: cookie domain override.
- `SESSION_COOKIE_PATH`: cookie path.

### Database

- `DB_USER`: runtime DB username.
- `DB_HOST`: runtime DB host.
- `DB_NAME`: runtime DB name.
- `DB_PASSWORD`: runtime DB password.
- `DB_PORT`: runtime DB port.
- `DATABASE_SSL`: enable DB SSL.
- `DATABASE_MAX_CLIENTS`: DB pool size.
- `DATABASE_IDLE_TIMEOUT_MS`: DB idle timeout.
- `DATABASE_CONNECTION_TIMEOUT_MS`: DB connection timeout.
- `DATABASE_STATEMENT_TIMEOUT_MS`: DB statement timeout.
- `DB_RUN_MIGRATIONS_ON_BOOT`: whether migrations run during boot.
- `ALLOW_RUNTIME_MIGRATIONS`: explicit policy gate for boot-time migrations.
- `DB_RUN_MAINTENANCE_ON_BOOT`: whether maintenance runs during boot.
- `DB_MAINTENANCE_INTERVAL_MS`: maintenance scheduler interval.
- `DB_FAILED_LOGINS_RETENTION_DAYS`: failed-login retention period.
- `DB_AUDIT_ARCHIVE_AFTER_DAYS`: audit archive threshold.

### Mobile/app secrets

- `HASH_APP_BIKE`: shared mobile/app secret for the bicycle app.
- `HASH_APP_LAUNDRY`: shared mobile/app secret for the laundry app.
- `HASH_APP_ASSET`: shared mobile/app secret for the asset app.
- `HASH_APP_GYM`: shared mobile/app secret for the gym app.

### Redis and shared infrastructure

- `REDIS_HOST`: Redis host.
- `REDIS_PORT`: Redis port.
- `REDIS_REQUIRED`: whether boot must fail if Redis is unavailable.
- `SESSION_REDIS_PREFIX`: session key prefix.

### Rate limiting and abuse protection

- `LOGIN_RATE_LIMIT_WINDOW_MS`: login rate-limit window.
- `LOGIN_RATE_LIMIT_MAX_BY_IP`: max login attempts per IP within the window.
- `LOGIN_RATE_LIMIT_MAX_BY_USERNAME`: max login attempts per username within the window.
- `QR_REQUEST_RATE_LIMIT_WINDOW_MS`: QR request rate-limit window.
- `QR_REQUEST_RATE_LIMIT_MAX`: max QR requests within the window.
- `PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MS`: password-change rate-limit window.
- `PASSWORD_CHANGE_RATE_LIMIT_MAX`: max password changes within the window.
- `API_RATE_LIMIT_WINDOW_MS`: API rate-limit window.
- `API_RATE_LIMIT_MAX`: API max requests within the window.

### Security workflow and admin identity

- `SECURITY_UPLOAD_MAX_FILE_SIZE`: upload size cap in bytes.
- `TWO_FACTOR_ENROLLMENT_TTL_SECONDS`: 2FA enrollment TTL.
- `ONE_TIME_QR_TTL_SECONDS`: one-time QR TTL.
- `ADMIN_USERNAME`: protected bootstrap/admin username.
- `BCRYPT_ROUNDS`: password hashing cost.
- `TRUST_PROXY`: Express trust-proxy setting.
- `LOG_LEVEL`: structured log level.

### Observability

- `OBSERVABILITY_METRICS_ENABLED`: whether metrics endpoint is enabled.
- `OBSERVABILITY_METRICS_AUTH_TOKEN`: bearer token for the metrics endpoint.
- `OBSERVABILITY_HEALTH_AUTH_TOKEN`: bearer token for protected health/readiness endpoints.
- `OBSERVABILITY_INSTANCE`: instance label for metrics and logs.

### Shutdown and transport tuning

- `GRACEFUL_SHUTDOWN_TIMEOUT_MS`: hard shutdown deadline.
- `CONNECTION_DRAIN_TIMEOUT_MS`: connection drain delay before force close.
- `KEEP_ALIVE_TIMEOUT_MS`: Node HTTP keep-alive timeout.
- `HEADERS_TIMEOUT_MS`: Node HTTP headers timeout.

### Backup and recovery

- `BACKUP_S3_BUCKET`: backup destination bucket.
- `BACKUP_RETENTION_DAYS`: backup retention period.
- `RPO_MINUTES`: target recovery point objective.
- `RTO_MINUTES`: target recovery time objective.
