#!/usr/bin/env bash
#
# Vizora PostgreSQL Restore Script
# Restores a database from a compressed backup file.
#
# Usage:
#   ./scripts/restore-db.sh <backup-file.sql.gz>
#   ./scripts/restore-db.sh --force <backup-file.sql.gz>
#   ./scripts/restore-db.sh --list                        # list available backups
#
# Options:
#   --force   Skip the confirmation prompt
#   --list    List available backup files and exit
#
# Environment variables (or via .env file):
#   DATABASE_URL  - PostgreSQL connection string (required)
#   BACKUP_DIR    - Directory where backups are stored (default: /var/backups/vizora)
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

FORCE=false
LIST=false
BACKUP_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --force)
            FORCE=true
            shift
            ;;
        --list)
            LIST=true
            shift
            ;;
        -*)
            echo "[ERROR] Unknown option: $1" >&2
            echo "Usage: $0 [--force] [--list] <backup-file.sql.gz>" >&2
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Load .env file if it exists and DATABASE_URL is not already set
if [[ -z "${DATABASE_URL:-}" ]]; then
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        # shellcheck disable=SC1091
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vizora}"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

log_info() {
    echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') $*"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

# Parse DATABASE_URL into components
parse_database_url() {
    local url="$1"

    local stripped="${url#postgresql://}"
    stripped="${stripped#postgres://}"

    local userinfo="${stripped%%@*}"
    local remainder="${stripped#*@}"

    PGUSER="${userinfo%%:*}"
    PGPASSWORD="${userinfo#*:}"

    local hostport="${remainder%%/*}"
    PGHOST="${hostport%%:*}"
    PGPORT="${hostport#*:}"

    local dbpart="${remainder#*/}"
    PGDATABASE="${dbpart%%\?*}"

    export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
}

# ---------------------------------------------------------------------------
# List mode
# ---------------------------------------------------------------------------

if [[ "$LIST" == true ]]; then
    echo "Available backups in $BACKUP_DIR:"
    echo ""
    for tier in daily weekly monthly; do
        dir="$BACKUP_DIR/$tier"
        if [[ -d "$dir" ]]; then
            count=$(find "$dir" -name "*.sql.gz" -type f 2>/dev/null | wc -l)
            echo "  $tier/ ($count files):"
            find "$dir" -name "*.sql.gz" -type f -printf "    %f  (%s bytes, %Tc)\n" 2>/dev/null | sort -r
        fi
    done
    echo ""
    exit 0
fi

# ---------------------------------------------------------------------------
# Validate inputs
# ---------------------------------------------------------------------------

if [[ -z "$BACKUP_FILE" ]]; then
    echo "Usage: $0 [--force] [--list] <backup-file.sql.gz>" >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  --force   Skip confirmation prompt" >&2
    echo "  --list    List available backups and exit" >&2
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL is not set. Set it in the environment or in .env"
    exit 1
fi

# Parse the connection string
parse_database_url "$DATABASE_URL"

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"

if [[ "$FORCE" != true ]]; then
    echo ""
    echo "============================================"
    echo "  VIZORA DATABASE RESTORE"
    echo "============================================"
    echo ""
    echo "  Backup file : $BACKUP_FILE"
    echo "  File size   : $BACKUP_SIZE"
    echo "  Target DB   : $PGDATABASE"
    echo "  Target host : $PGHOST:$PGPORT"
    echo ""
    echo "  WARNING: This will DROP and RECREATE all"
    echo "  tables in the target database."
    echo ""
    echo "============================================"
    echo ""
    read -rp "Are you sure you want to proceed? (yes/no): " CONFIRM

    if [[ "$CONFIRM" != "yes" ]]; then
        log_info "Restore cancelled by user."
        exit 0
    fi
fi

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------

log_info "Starting database restore..."
log_info "Source: $BACKUP_FILE ($BACKUP_SIZE)"
log_info "Target: $PGDATABASE on $PGHOST:$PGPORT"

# The backup is a plain-format SQL dump compressed with gzip.
# Decompress and pipe directly into psql.
if gunzip -c "$BACKUP_FILE" \
    | psql \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --single-transaction \
        --set ON_ERROR_STOP=1 \
        --quiet \
        2>&1; then

    log_info "Database restored successfully from $BACKUP_FILE"
else
    log_error "Database restore failed."
    log_error "The database may be in an inconsistent state."
    log_error "The --single-transaction flag should have rolled back on error."
    exit 1
fi

# ---------------------------------------------------------------------------
# Post-restore verification
# ---------------------------------------------------------------------------

log_info "Verifying restore - counting tables..."

TABLE_COUNT=$(psql \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --tuples-only \
    --no-align \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
    2>/dev/null)

log_info "Restore complete. Found $TABLE_COUNT table(s) in the public schema."
exit 0
