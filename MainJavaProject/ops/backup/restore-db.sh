#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:?required}"
: "${DB_PORT:?required}"
: "${DB_NAME:?required}"
: "${DB_USER:?required}"
: "${DB_PASSWORD:?required}"
: "${BACKUP_FILE:?required}"

export PGPASSWORD="$DB_PASSWORD"
pg_restore   --clean   --if-exists   --no-owner   --no-privileges   --host="$DB_HOST"   --port="$DB_PORT"   --username="$DB_USER"   --dbname="$DB_NAME"   "$BACKUP_FILE"

echo "Restore completed from $BACKUP_FILE"
