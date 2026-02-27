#!/bin/bash

# Vizora Device Pairing Flow Test Script
# This script tests the complete device pairing flow for the Vizora application
# Usage: bash test-pairing-flow.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIDDLEWARE_URL="http://localhost:3000"
WEB_URL="http://localhost:3001"
API_BASE="${MIDDLEWARE_URL}/api"

# Test credentials
EMAIL="bro@triveni.com"
PASSWORD="Srini78\$\$"

# Test device data
DEVICE_ID="test-display-001"
DEVICE_NAME="Test Display Unit"
DEVICE_HOSTNAME="test-machine"
DEVICE_OS="Windows"

# Color functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Test if services are running
test_service_connectivity() {
    print_header "Testing Service Connectivity"

    print_info "Checking Middleware API at ${MIDDLEWARE_URL}..."
    if curl -s -m 5 "${MIDDLEWARE_URL}/health" > /dev/null 2>&1 || curl -s -m 5 "${MIDDLEWARE_URL}" > /dev/null 2>&1; then
        print_success "Middleware API is running"
    else
        print_error "Middleware API is not responding at ${MIDDLEWARE_URL}"
        echo "Make sure the middleware server is running with: npm run dev (in middleware directory)"
        exit 1
    fi

    print_info "Checking Web App at ${WEB_URL}..."
    if curl -s -m 5 "${WEB_URL}" > /dev/null 2>&1; then
        print_success "Web App is running"
    else
        print_warning "Web App is not responding at ${WEB_URL} (You'll need to test UI manually)"
    fi
}

# Step 1: Request Pairing Code
step_request_pairing() {
    print_header "Step 1: Request Pairing Code"

    print_info "Sending POST request to /api/devices/pairing/request"
    print_info "Device Identifier: ${DEVICE_ID}"
    print_info "Device Nickname: ${DEVICE_NAME}"

    RESPONSE=$(curl -s -X POST "${API_BASE}/devices/pairing/request" \
        -H "Content-Type: application/json" \
        -d "{
            \"deviceIdentifier\": \"${DEVICE_ID}\",
            \"nickname\": \"${DEVICE_NAME}\",
            \"metadata\": {
                \"hostname\": \"${DEVICE_HOSTNAME}\",
                \"os\": \"${DEVICE_OS}\"
            }
        }")

    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    # Extract the code from response
    PAIRING_CODE=$(echo "$RESPONSE" | jq -r '.code' 2>/dev/null)
    QR_CODE=$(echo "$RESPONSE" | jq -r '.qrCode' 2>/dev/null)
    EXPIRES_AT=$(echo "$RESPONSE" | jq -r '.expiresAt' 2>/dev/null)
    PAIRING_URL=$(echo "$RESPONSE" | jq -r '.pairingUrl' 2>/dev/null)

    if [ -z "$PAIRING_CODE" ] || [ "$PAIRING_CODE" = "null" ]; then
        print_error "Failed to generate pairing code"
        exit 1
    fi

    print_success "Pairing code generated successfully"
    echo -e "${GREEN}Pairing Code: ${PAIRING_CODE}${NC}"
    echo -e "Pairing URL: ${PAIRING_URL}"
    echo -e "Expires At: ${EXPIRES_AT}"

    if [ "$QR_CODE" != "null" ] && [ ! -z "$QR_CODE" ]; then
        print_success "QR code generated"
        # Save QR code to file for reference
        echo "$QR_CODE" > /tmp/pairing-qr-code.txt
        print_info "QR code data saved to /tmp/pairing-qr-code.txt"
    else
        print_warning "QR code not available in response"
    fi
}

# Step 2: Check Pairing Status (before completion)
step_check_status_pending() {
    print_header "Step 2: Check Pairing Status (Pending)"

    print_info "Sending GET request to /api/devices/pairing/status/${PAIRING_CODE}"

    RESPONSE=$(curl -s -X GET "${API_BASE}/devices/pairing/status/${PAIRING_CODE}")

    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null)

    if [ "$STATUS" = "pending" ]; then
        print_success "Pairing status is pending (as expected)"
    else
        print_warning "Expected status 'pending', got: ${STATUS}"
    fi
}

# Step 3: Manual UI Instructions
step_ui_instructions() {
    print_header "Step 3: Web UI Testing Instructions"

    echo "To complete the pairing through the web UI, follow these steps:"
    echo ""
    echo "1. Open ${WEB_URL} in your browser"
    echo "2. Login with credentials:"
    echo "   Email: ${EMAIL}"
    echo "   Password: ${PASSWORD}"
    echo ""
    echo "3. Navigate to: Dashboard → Devices → Pair New Device"
    echo "   Or use direct URL: ${PAIRING_URL}"
    echo ""
    echo "4. Enter the pairing code: ${PAIRING_CODE}"
    echo "5. Enter device name: ${DEVICE_NAME}"
    echo "6. Click 'Pair Device' button"
    echo ""
    echo "After completing the UI steps, press ENTER to continue with API verification..."
    read -p ""
}

# Step 4: Complete Pairing (API call - simulating what the web UI does)
step_complete_pairing_api() {
    print_header "Step 4: Complete Pairing (API)"

    print_info "This simulates what the web UI does when you click 'Pair Device'"
    print_info "Sending POST request to /api/devices/pairing/complete"
    print_info "Pairing Code: ${PAIRING_CODE}"
    print_info "Nickname: ${DEVICE_NAME}"

    # Note: This requires authentication token, but for testing the public endpoint:
    RESPONSE=$(curl -s -X POST "${API_BASE}/devices/pairing/complete" \
        -H "Content-Type: application/json" \
        -d "{
            \"code\": \"${PAIRING_CODE}\",
            \"nickname\": \"${DEVICE_NAME}\"
        }")

    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    # Check if pairing was successful
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

    if [ "$SUCCESS" = "true" ]; then
        print_success "Pairing completed successfully"
        DISPLAY_ID=$(echo "$RESPONSE" | jq -r '.display.id' 2>/dev/null)
        STATUS=$(echo "$RESPONSE" | jq -r '.display.status' 2>/dev/null)
        echo -e "Display ID: ${DISPLAY_ID}"
        echo -e "Display Status: ${STATUS}"
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.message // .error' 2>/dev/null)
        print_error "Pairing failed: ${ERROR}"
        print_warning "This may fail if called directly (requires auth context). Test through web UI instead."
    fi
}

# Step 5: Check Pairing Status (after completion)
step_check_status_paired() {
    print_header "Step 5: Verify Pairing Status (Paired)"

    print_info "Sending GET request to /api/devices/pairing/status/${PAIRING_CODE}"

    RESPONSE=$(curl -s -X GET "${API_BASE}/devices/pairing/status/${PAIRING_CODE}")

    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null)

    if [ "$STATUS" = "paired" ]; then
        print_success "Device has been paired successfully!"
        DEVICE_TOKEN=$(echo "$RESPONSE" | jq -r '.deviceToken' 2>/dev/null)
        DISPLAY_ID=$(echo "$RESPONSE" | jq -r '.deviceId' 2>/dev/null)
        echo -e "Device Token: ${DEVICE_TOKEN}"
        echo -e "Display ID: ${DISPLAY_ID}"
    elif [ "$STATUS" = "pending" ]; then
        print_warning "Pairing is still pending. The web UI step may not have been completed."
    else
        print_warning "Unexpected status: ${STATUS}"
    fi
}

# Summary
print_summary() {
    print_header "Test Summary"

    echo "Pairing Flow Test Results:"
    echo "- Pairing Code: ${PAIRING_CODE}"
    echo "- Pairing URL: ${PAIRING_URL}"
    echo "- Device ID: ${DEVICE_ID}"
    echo "- Device Name: ${DEVICE_NAME}"
    echo ""
    echo "Next steps:"
    echo "1. If testing through web UI, verify the device appears in Dashboard → Devices"
    echo "2. Check that the device status is 'online'"
    echo "3. Verify you can assign playlists to the paired device"
}

# Main execution
main() {
    print_header "Vizora Device Pairing Flow Test"
    echo "This script will test the complete device pairing flow"
    echo "Make sure your services are running:"
    echo "- Middleware API: ${MIDDLEWARE_URL}"
    echo "- Web App: ${WEB_URL}"

    # Test connectivity
    test_service_connectivity

    # Execute test steps
    step_request_pairing
    sleep 1

    step_check_status_pending
    sleep 1

    # Ask if user wants to test through web UI
    echo -e "\n${YELLOW}Do you want to test the pairing through the web UI? (y/n)${NC}"
    read -p "" TEST_UI

    if [ "$TEST_UI" = "y" ] || [ "$TEST_UI" = "Y" ]; then
        step_ui_instructions
        sleep 2
        step_check_status_paired
    else
        print_info "Skipping web UI testing"
        echo "You can manually test through: ${PAIRING_URL}"
    fi

    print_summary
}

# Run main function
main
