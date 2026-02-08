#!/usr/bin/env bash
# =============================================================================
# Vizora SSL Certificate Setup
# =============================================================================
# Obtains a Let's Encrypt TLS certificate for the Vizora platform using certbot.
#
# Usage:
#   ./scripts/setup-ssl.sh <domain> [--email <email>] [--staging]
#
# Examples:
#   ./scripts/setup-ssl.sh signage.example.com
#   ./scripts/setup-ssl.sh signage.example.com --email admin@example.com
#   ./scripts/setup-ssl.sh signage.example.com --staging   # Use Let's Encrypt staging (for testing)
#
# Prerequisites:
#   - certbot must be installed (apt install certbot / brew install certbot)
#   - Port 80 must be available (stop nginx first if running)
#   - Run as root or with sudo
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
DOMAIN=""
EMAIL=""
STAGING=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --staging)
            STAGING="--staging"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <domain> [--email <email>] [--staging]"
            echo ""
            echo "Arguments:"
            echo "  <domain>           The domain name for the certificate (required)"
            echo "  --email <email>    Email for Let's Encrypt notifications (recommended)"
            echo "  --staging          Use Let's Encrypt staging environment (for testing)"
            echo ""
            echo "Examples:"
            echo "  $0 signage.example.com"
            echo "  $0 signage.example.com --email admin@example.com"
            echo "  $0 signage.example.com --staging"
            exit 0
            ;;
        -*)
            error "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
        *)
            if [[ -z "$DOMAIN" ]]; then
                DOMAIN="$1"
            else
                error "Unexpected argument: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

if [[ -z "$DOMAIN" ]]; then
    error "Domain name is required."
    echo ""
    echo "Usage: $0 <domain> [--email <email>] [--staging]"
    exit 1
fi

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
if ! command -v certbot &> /dev/null; then
    error "certbot is not installed."
    echo ""
    echo "Install it with one of:"
    echo "  Ubuntu/Debian:  sudo apt update && sudo apt install -y certbot"
    echo "  macOS:          brew install certbot"
    echo "  CentOS/RHEL:    sudo dnf install -y certbot"
    exit 1
fi

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (required by certbot standalone mode)."
    echo "  sudo $0 $DOMAIN ${EMAIL:+--email $EMAIL} ${STAGING:+--staging}"
    exit 1
fi

# Check if port 80 is in use
if ss -tlnp 2>/dev/null | grep -q ':80 ' || netstat -tlnp 2>/dev/null | grep -q ':80 '; then
    warn "Port 80 appears to be in use."
    echo "  Certbot standalone mode needs port 80. Stop any services using it first:"
    echo "    docker compose -f docker/docker-compose.yml stop nginx"
    echo ""
    read -rp "Continue anyway? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        info "Aborted."
        exit 0
    fi
fi

# ---------------------------------------------------------------------------
# Build certbot command
# ---------------------------------------------------------------------------
CERTBOT_ARGS=(
    certonly
    --standalone
    --preferred-challenges http
    -d "$DOMAIN"
    --cert-name vizora
    --non-interactive
    --agree-tos
)

if [[ -n "$EMAIL" ]]; then
    CERTBOT_ARGS+=(--email "$EMAIL")
else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
    warn "No email provided. You will not receive expiry notifications."
fi

if [[ -n "$STAGING" ]]; then
    CERTBOT_ARGS+=("$STAGING")
    warn "Using Let's Encrypt STAGING environment. Certificates will NOT be trusted by browsers."
fi

# ---------------------------------------------------------------------------
# Obtain certificate
# ---------------------------------------------------------------------------
info "Requesting certificate for: $DOMAIN"
echo ""

certbot "${CERTBOT_ARGS[@]}"

# ---------------------------------------------------------------------------
# Verify certificate files
# ---------------------------------------------------------------------------
CERT_DIR="/etc/letsencrypt/live/vizora"

echo ""
if [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" ]]; then
    info "Certificate obtained successfully!"
    echo ""
    echo "  Certificate:   $CERT_DIR/fullchain.pem"
    echo "  Private Key:   $CERT_DIR/privkey.pem"
    echo "  Chain:         $CERT_DIR/chain.pem"
    echo ""

    # Show certificate details
    echo "  Certificate details:"
    openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -subject -dates 2>/dev/null | sed 's/^/    /'
    echo ""
else
    error "Certificate files not found at $CERT_DIR"
    echo "  Check the certbot output above for errors."
    exit 1
fi

# ---------------------------------------------------------------------------
# Next steps
# ---------------------------------------------------------------------------
echo "==========================================================================="
echo "  NEXT STEPS"
echo "==========================================================================="
echo ""
echo "  1. Start the Nginx reverse proxy:"
echo "     docker compose -f docker/docker-compose.yml up -d nginx"
echo ""
echo "  2. Verify HTTPS is working:"
echo "     curl -I https://$DOMAIN"
echo ""
echo "  3. Set up automatic renewal (add to crontab):"
echo "     0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f $(pwd)/docker/docker-compose.yml exec nginx nginx -s reload'"
echo ""
echo "  4. (Optional) Test renewal without actually renewing:"
echo "     certbot renew --dry-run"
echo ""
echo "==========================================================================="
