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

## Production security baseline

This baseline is mandatory before any public VPS deployment.

### Network perimeter

- Use a Hetzner Cloud Firewall on every public server.
- Allow inbound `80/tcp` and `443/tcp` from the internet.
- Allow inbound `22/tcp` only from a fixed administrator IP range or VPN range.
- Block all other inbound traffic.
- Keep host-level `ufw` enabled as defense in depth, but do not rely on it to protect
  Docker-published ports. Docker creates its own firewall/NAT rules for published ports,
  and published container traffic can bypass normal `ufw` input rules.
- Do not disable Docker iptables management globally. That can break container networking
  and is not a safe default for this deployment model.

Required host firewall commands:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from ADMIN_OR_VPN_CIDR to any port 22 proto tcp
sudo ufw --force enable
sudo ufw status verbose
```

### SSH access

- Root SSH login must be disabled.
- Password authentication must be disabled.
- Only key-based login for the deployment user is allowed.
- Prefer VPN-only SSH. If there is no VPN, restrict SSH to a fixed source IP in both
  Hetzner Cloud Firewall and `ufw`.
- Enable `fail2ban` for sshd.

Required SSH hardening:

```bash
sudo tee /etc/ssh/sshd_config.d/99-gss-hardening.conf >/dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowUsers deploy
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
sudo sshd -t
sudo systemctl reload ssh
```

### Docker port exposure

- Production compose files must not publish PostgreSQL or Redis to the host.
- PostgreSQL and Redis must be reachable only on the private Docker network.
- The application container should use `expose: ["3000"]`, not `ports`, when a reverse
  proxy is running in the same compose project.
- Only the reverse proxy should publish `80:80` and `443:443`.
- The local development `docker-compose.yml` publishes database ports for developer
  convenience and must not be used as-is for public production.

Pre-flight checks:

```bash
docker compose --env-file /opt/gss/.env -f ops/compose/docker-compose.production.yml config
sudo ss -tulpn
```

Expected public listeners: `22`, `80`, and `443` only. Ports `3000`, `5432`, and
`6379` must not be public.

### Docker and image updates

- Deploy immutable image tags, preferably commit SHA tags. Do not deploy `latest` to
  production.
- Rebuild with fresh base images during each release using `docker build --pull`.
- Run dependency audit and image vulnerability scanning in CI before publishing.
- Patch the host OS weekly, and immediately for critical CVEs.
- Patch Docker Engine through the OS package manager during a maintenance window.
- Remove unused images after a successful deployment, but keep the previous successful
  image tag available for rollback.

Release commands:

```bash
export IMAGE_REF="ghcr.io/ORG/REPO:GIT_SHA"
docker pull "$IMAGE_REF"
docker compose --env-file /opt/gss/.env -f ops/compose/docker-compose.production.yml up -d --remove-orphans
docker image prune -f
```

### Backups and restore testing

- Hetzner snapshots/backups are not sufficient alone.
- Keep encrypted PostgreSQL backups outside the VPS and outside the primary Hetzner
  project.
- Use daily full backups plus WAL or incremental archiving when the RPO target requires
  less than 24 hours of possible data loss.
- Encrypt backups before upload. Store encryption keys separately from the VPS.
- Run a restore drill at least monthly and after every major schema change.
- A backup is not considered valid until a restore has been tested.

Minimum backup check:

```bash
test -s latest-backup.sql.gz
gpg --decrypt latest-backup.sql.gz.gpg >/dev/null
```

Minimum restore drill:

```bash
createdb gss_restore_drill
gunzip -c latest-backup.sql.gz | psql gss_restore_drill
npm run test:smoke
dropdb gss_restore_drill
```

### Monitoring and alerts

- Monitor `/health/ready` and alert when it returns non-2xx.
- Scrape `/metrics` only with `OBSERVABILITY_METRICS_AUTH_TOKEN`.
- Alerts must cover: instance down, disk usage, memory pressure, CPU saturation,
  container restart loop, database readiness, Redis readiness, high HTTP 5xx rate,
  login failure spike, and backup failure.
- Store logs outside the container lifecycle. Docker log rotation is required.

Docker log rotation:

```bash
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  },
  "live-restore": true
}
EOF
sudo systemctl restart docker
```

### Application hardening

- Production must use HTTPS `APP_URL`.
- `TRUST_PROXY=true` is required when TLS terminates at a reverse proxy.
- `SESSION_COOKIE_SECURE=true` is required in production.
- Keep `SESSION_COOKIE_SAME_SITE=lax` unless a real cross-site flow requires otherwise.
- Redis is mandatory for sessions in staging and production. Memory sessions are not
  acceptable outside local development.
- `CSP_REPORT_ONLY=false` is required once CSP has been validated.
- CSRF protection must remain enabled for all unsafe HTTP methods.
- Rotate `SESSION_SECRET`, access-token, refresh-token, database, Redis, metrics, and
  health tokens on a schedule and after any suspected leak.
- Keep `BCRYPT_ROUNDS` between `12` and `15`; benchmark before increasing.

Required production environment posture:

```text
NODE_ENV=production
ENVIRONMENT_NAME=production
APP_URL=https://example.com
APP_HOST=example.com
TLS_EMAIL=ops@example.com
IMAGE_REF=ghcr.io/ORG/REPO:GIT_SHA
TRUST_PROXY=true
SESSION_COOKIE_SECURE=true
REDIS_REQUIRED=true
CSP_REPORT_ONLY=false
OBSERVABILITY_METRICS_AUTH_TOKEN=<real secret>
OBSERVABILITY_HEALTH_AUTH_TOKEN=<real secret>
```

### Database hardening

- PostgreSQL must not listen publicly.
- Use separate credentials for runtime, migrations, and backups where the deployment
  platform supports it.
- Runtime credentials must not own the database schema.
- Keep `DATABASE_STATEMENT_TIMEOUT_MS` enabled.
- Keep `DATABASE_MAX_CLIENTS` sized below the PostgreSQL connection limit with room for
  maintenance, migrations, and backup jobs.
- Run schema changes through the migration gate before traffic shifts.

### Hetzner account security

- Enable 2FA on the Hetzner account before attaching production resources.
- Store the Hetzner recovery key offline.
- Use more than one active 2FA method when possible.
- Use project-level access with least privilege for team members.
- API tokens must be scoped narrowly, stored outside git, and rotated regularly.

### CIS audit

- Run a CIS-oriented host audit before production launch and after major OS changes.
- Track exceptions explicitly; do not silently ignore findings.
- At minimum, audit Ubuntu host hardening and Docker host hardening.
- Suggested tools: CIS-CAT Pro if available, plus `lynis` or `docker-bench-security`
  for practical local checks.

Example audit commands:

```bash
sudo apt install -y lynis
sudo lynis audit system

git clone https://github.com/docker/docker-bench-security.git
cd docker-bench-security
sudo sh docker-bench-security.sh
```

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
