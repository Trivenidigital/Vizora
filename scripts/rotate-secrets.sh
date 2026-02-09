#!/bin/bash
#
# Vizora Secret Rotation Script
# Generates new JWT secrets and provides instructions for a safe rollover.
#

set -euo pipefail

echo "========================================"
echo "  Vizora Secret Rotation Utility"
echo "========================================"
echo ""

# Generate new secrets (48 bytes = 64 base64 characters, well above the 32-char minimum)
NEW_JWT_SECRET=$(openssl rand -base64 48)
NEW_DEVICE_JWT_SECRET=$(openssl rand -base64 48)

echo "New secrets generated:"
echo ""
echo "  JWT_SECRET=${NEW_JWT_SECRET}"
echo "  DEVICE_JWT_SECRET=${NEW_DEVICE_JWT_SECRET}"
echo ""
echo "========================================"
echo "  IMPORTANT: Read before proceeding"
echo "========================================"
echo ""
echo "1. Rotating JWT_SECRET will invalidate ALL existing user sessions."
echo "   Users will need to log in again."
echo ""
echo "2. Rotating DEVICE_JWT_SECRET will invalidate ALL existing device tokens."
echo "   Every paired display will need to be re-paired."
echo ""
echo "Steps to apply:"
echo ""
echo "  a) Update your .env file (or deployment secrets) with the new values above."
echo ""
echo "  b) Perform a rolling restart of all services:"
echo "       pm2 restart ecosystem.config.js"
echo "     Or if running manually:"
echo "       Restart middleware, then realtime, then web."
echo ""
echo "  c) Notify users that they will need to log in again."
echo ""
echo "  d) If DEVICE_JWT_SECRET was rotated, re-pair all display devices."
echo ""
echo "Tip: To rotate only user sessions, update just JWT_SECRET."
echo "     To rotate only device tokens, update just DEVICE_JWT_SECRET."
echo ""
