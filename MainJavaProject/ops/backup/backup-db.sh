#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:?required}"
: "${DB_PORT:?required}"
: "${DB_NAME:?required}"
: "${DB_USER:?required}"
: "${DB_PASSWORD:?required}"
: "${BACKUP_DIR:=./backups}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"

export PGPASSWORD="$DB_PASSWORD"
pg_dump   --format=custom   --no-owner   --no-privileges   --host="$DB_HOST"   --port="$DB_PORT"   --username="$DB_USER"   --file="$FILE"   "$DB_NAME"

echo "Backup created at $FILE"
