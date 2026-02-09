#!/usr/bin/env bash
#
# Vizora MinIO Backup Script
# Mirrors the MinIO bucket to a local backup directory using mc (MinIO Client).
#
# Prerequisites:
#   - mc (MinIO Client) must be installed and configured:
#       mc alias set vizora http://localhost:9000 ACCESS_KEY SECRET_KEY
#
# Usage:
#   ./scripts/backup-minio.sh
#
# Environment variables:
#   MINIO_ALIAS       - mc alias name (default: vizora)
#   MINIO_BUCKET      - Bucket to back up (default: vizora-assets)
#   BACKUP_DIR        - Base backup directory (default: /var/backups/vizora)

set -euo pipefail

MINIO_ALIAS="${MINIO_ALIAS:-vizora}"
MINIO_BUCKET="${MINIO_BUCKET:-vizora-assets}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/vizora}/minio"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
TARGET="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$TARGET"

echo "[INFO] Starting MinIO mirror: ${MINIO_ALIAS}/${MINIO_BUCKET} -> $TARGET"
mc mirror "${MINIO_ALIAS}/${MINIO_BUCKET}" "$TARGET" --quiet

BACKUP_SIZE="$(du -sh "$TARGET" | cut -f1)"
echo "[INFO] MinIO backup complete: $TARGET ($BACKUP_SIZE)"

# Prune mirrors older than 4 weeks
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime +28 -print -exec rm -rf {} \; 2>/dev/null | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[INFO] Pruned $DELETED old MinIO backup(s)."
fi
