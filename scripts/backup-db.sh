#!/usr/bin/env bash
#
# Vizora PostgreSQL Backup Script
# Creates compressed, timestamped backups with automatic rotation.
#
# Usage:
#   ./scripts/backup-db.sh
#
# Environment variables (or via .env file):
#   DATABASE_URL          - PostgreSQL connection string (required)
#   BACKUP_DIR            - Directory to store backups (default: /var/backups/vizora)
#   BACKUP_RETENTION_DAYS - Days to keep daily backups (default: 7)
#
# Exit codes:
#   0 - Success
#   1 - Failure

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env file if it exists and DATABASE_URL is not already set
if [[ -z "${DATABASE_URL:-}" ]]; then
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        # shellcheck disable=SC1091
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
fi

# Validate DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') DATABASE_URL is not set. Set it in the environment or in .env"
    exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vizora}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=3

TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
DATE_STAMP="$(date '+%Y%m%d')"
DAY_OF_WEEK="$(date '+%u')"   # 1=Monday, 7=Sunday
DAY_OF_MONTH="$(date '+%d')"
BACKUP_FILENAME="vizora_backup_${TIMESTAMP}.sql.gz"

# Sub-directories for rotation tiers
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
MONTHLY_DIR="$BACKUP_DIR/monthly"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

log_info() {
    echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

cleanup_on_error() {
    if [[ -f "$DAILY_DIR/$BACKUP_FILENAME" ]]; then
        rm -f "$DAILY_DIR/$BACKUP_FILENAME"
        log_error "Removed incomplete backup file."
    fi
    log_error "Backup failed."
    exit 1
}

# Parse DATABASE_URL into components for pg_dump
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?options
parse_database_url() {
    local url="$1"

    # Strip the protocol prefix
    local stripped="${url#postgresql://}"
    stripped="${stripped#postgres://}"

    # Extract user:password
    local userinfo="${stripped%%@*}"
    local remainder="${stripped#*@}"

    PGUSER="${userinfo%%:*}"
    PGPASSWORD="${userinfo#*:}"

    # Extract host:port
    local hostport="${remainder%%/*}"
    PGHOST="${hostport%%:*}"
    PGPORT="${hostport#*:}"

    # Extract database name (strip query string)
    local dbpart="${remainder#*/}"
    PGDATABASE="${dbpart%%\?*}"

    export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

trap cleanup_on_error ERR

log_info "Starting Vizora database backup..."
log_info "Backup directory: $BACKUP_DIR"

# Create backup directories
for dir in "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"; do
    if ! mkdir -p "$dir"; then
        log_error "Failed to create directory: $dir"
        exit 1
    fi
done

# Parse the connection string
parse_database_url "$DATABASE_URL"

log_info "Connecting to database '$PGDATABASE' on $PGHOST:$PGPORT..."

# Perform the backup
# Uses pg_dump with custom format piped through gzip for maximum compression.
# --no-owner and --no-privileges make the backup portable across environments.
if pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=plain \
    2>/dev/null \
    | gzip -9 > "$DAILY_DIR/$BACKUP_FILENAME"; then

    BACKUP_SIZE="$(du -h "$DAILY_DIR/$BACKUP_FILENAME" | cut -f1)"
    log_info "Daily backup created: $DAILY_DIR/$BACKUP_FILENAME ($BACKUP_SIZE)"
else
    log_error "pg_dump failed."
    exit 1
fi

# Verify the backup file is not empty
if [[ ! -s "$DAILY_DIR/$BACKUP_FILENAME" ]]; then
    log_error "Backup file is empty. Something went wrong."
    rm -f "$DAILY_DIR/$BACKUP_FILENAME"
    exit 1
fi

# Verify backup integrity by listing contents via pg_restore
log_info "Verifying backup integrity..."
if gunzip -c "$DAILY_DIR/$BACKUP_FILENAME" | pg_restore --list > /dev/null 2>&1; then
    log_info "Backup integrity verified (pg_restore --list passed)."
else
    # Plain-format dumps cannot be verified with pg_restore --list; check gzip integrity instead
    if gzip -t "$DAILY_DIR/$BACKUP_FILENAME" 2>/dev/null; then
        log_info "Backup gzip integrity verified."
    else
        log_error "Backup integrity check failed."
        exit 1
    fi
fi

# Generate SHA-256 checksum for the backup file
sha256sum "$DAILY_DIR/$BACKUP_FILENAME" > "$DAILY_DIR/$BACKUP_FILENAME.sha256"
log_info "Checksum written: $DAILY_DIR/$BACKUP_FILENAME.sha256"

# ---------------------------------------------------------------------------
# Optional: Off-site S3 Upload
# ---------------------------------------------------------------------------
# Set BACKUP_S3_BUCKET (e.g. s3://my-vizora-backups) to enable off-site copies.

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
    if command -v aws &>/dev/null; then
        log_info "Uploading backup to S3: ${BACKUP_S3_BUCKET}..."
        if aws s3 cp "$DAILY_DIR/$BACKUP_FILENAME" "${BACKUP_S3_BUCKET}/daily/$BACKUP_FILENAME" \
            && aws s3 cp "$DAILY_DIR/$BACKUP_FILENAME.sha256" "${BACKUP_S3_BUCKET}/daily/$BACKUP_FILENAME.sha256"; then
            log_info "S3 upload complete."
        else
            log_error "S3 upload failed. Local backup is still intact."
        fi
    else
        log_info "BACKUP_S3_BUCKET is set but 'aws' CLI is not installed. Skipping S3 upload."
    fi
fi

# ---------------------------------------------------------------------------
# Rotation: Promote to weekly (Sundays) and monthly (1st of month)
# ---------------------------------------------------------------------------

# Weekly: copy Sunday's backup
if [[ "$DAY_OF_WEEK" == "7" ]]; then
    WEEKLY_FILENAME="vizora_weekly_${DATE_STAMP}.sql.gz"
    cp "$DAILY_DIR/$BACKUP_FILENAME" "$WEEKLY_DIR/$WEEKLY_FILENAME"
    log_info "Weekly backup created: $WEEKLY_DIR/$WEEKLY_FILENAME"
fi

# Monthly: copy 1st-of-month backup
if [[ "$DAY_OF_MONTH" == "01" ]]; then
    MONTHLY_FILENAME="vizora_monthly_${DATE_STAMP}.sql.gz"
    cp "$DAILY_DIR/$BACKUP_FILENAME" "$MONTHLY_DIR/$MONTHLY_FILENAME"
    log_info "Monthly backup created: $MONTHLY_DIR/$MONTHLY_FILENAME"
fi

# ---------------------------------------------------------------------------
# Rotation: Prune old backups
# ---------------------------------------------------------------------------

# Remove daily backups older than BACKUP_RETENTION_DAYS
DELETED_DAILY=$(find "$DAILY_DIR" -name "vizora_backup_*.sql.gz" -type f -mtime +"$BACKUP_RETENTION_DAYS" -print -delete 2>/dev/null | wc -l)
if [[ "$DELETED_DAILY" -gt 0 ]]; then
    log_info "Pruned $DELETED_DAILY daily backup(s) older than $BACKUP_RETENTION_DAYS days."
fi

# Remove weekly backups older than BACKUP_RETENTION_WEEKS weeks
DELETED_WEEKLY=$(find "$WEEKLY_DIR" -name "vizora_weekly_*.sql.gz" -type f -mtime +$((BACKUP_RETENTION_WEEKS * 7)) -print -delete 2>/dev/null | wc -l)
if [[ "$DELETED_WEEKLY" -gt 0 ]]; then
    log_info "Pruned $DELETED_WEEKLY weekly backup(s) older than $BACKUP_RETENTION_WEEKS weeks."
fi

# Remove monthly backups older than BACKUP_RETENTION_MONTHS months (approx 30 days each)
DELETED_MONTHLY=$(find "$MONTHLY_DIR" -name "vizora_monthly_*.sql.gz" -type f -mtime +$((BACKUP_RETENTION_MONTHS * 30)) -print -delete 2>/dev/null | wc -l)
if [[ "$DELETED_MONTHLY" -gt 0 ]]; then
    log_info "Pruned $DELETED_MONTHLY monthly backup(s) older than $BACKUP_RETENTION_MONTHS months."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

REMAINING_DAILY=$(find "$DAILY_DIR" -name "vizora_backup_*.sql.gz" -type f 2>/dev/null | wc -l)
REMAINING_WEEKLY=$(find "$WEEKLY_DIR" -name "vizora_weekly_*.sql.gz" -type f 2>/dev/null | wc -l)
REMAINING_MONTHLY=$(find "$MONTHLY_DIR" -name "vizora_monthly_*.sql.gz" -type f 2>/dev/null | wc -l)

log_info "Backup complete. Inventory: $REMAINING_DAILY daily, $REMAINING_WEEKLY weekly, $REMAINING_MONTHLY monthly."
exit 0
