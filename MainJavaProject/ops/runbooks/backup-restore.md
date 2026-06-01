# Backup and restore runbook

## Backup policy

- PostgreSQL full backup every 24 hours.
- WAL or incremental backup stream for point-in-time recovery.
- Keep at least 14 days of backups.
- Encrypt backups at rest and in transit.
- Store backups outside the primary host.

## Restore drill

1. Provision an empty restore database.
2. Restore the latest full backup.
3. Replay WAL or incremental logs to the target point in time.
4. Run smoke checks on auth, QR approval flow, refresh, and websocket connect.
5. Record achieved RPO and RTO.

## Commands

Use the scripts in `ops/backup/` with environment variables loaded from your secret store.
