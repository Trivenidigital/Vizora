#!/usr/bin/env bash
#
# Vizora — Install backup cron jobs
#
# Usage:
#   sudo ./scripts/setup-cron.sh
#
# This script installs (or replaces) crontab entries for automated backups.
# It is idempotent — running it multiple times will not create duplicates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Vizora backup cron jobs..."

# Build the crontab block with a marker so we can replace it idempotently
CRON_BLOCK="# --- BEGIN VIZORA BACKUPS ---
# Daily PostgreSQL backup at 2:00 AM
0 2 * * * ${SCRIPT_DIR}/backup-db.sh >> /var/log/vizora/backup-db.log 2>&1
# Daily MongoDB backup at 3:00 AM
0 3 * * * ${SCRIPT_DIR}/backup-mongodb.sh >> /var/log/vizora/backup-mongodb.log 2>&1
# Weekly MinIO backup on Sunday at 4:00 AM
0 4 * * 0 ${SCRIPT_DIR}/backup-minio.sh >> /var/log/vizora/backup-minio.log 2>&1
# Weekly ClickHouse backup on Sunday at 5:00 AM
0 5 * * 0 ${SCRIPT_DIR}/backup-clickhouse.sh >> /var/log/vizora/backup-clickhouse.log 2>&1
# --- END VIZORA BACKUPS ---"

# Ensure log directory exists
mkdir -p /var/log/vizora

# Remove existing Vizora block (if any) and append the new one
EXISTING=$(crontab -l 2>/dev/null || true)
CLEANED=$(echo "$EXISTING" | sed '/# --- BEGIN VIZORA BACKUPS ---/,/# --- END VIZORA BACKUPS ---/d')

echo "${CLEANED}
${CRON_BLOCK}" | crontab -

echo "Cron jobs installed. Current crontab:"
crontab -l
