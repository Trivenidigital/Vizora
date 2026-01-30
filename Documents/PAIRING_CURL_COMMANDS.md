# Vizora Device Pairing - cURL Command Reference

Quick reference for testing the pairing flow using cURL commands.

## Configuration

```bash
# Base URLs
MIDDLEWARE_API="http://localhost:3000/api"
WEB_APP="http://localhost:3001"

# Test credentials
EMAIL="bro@triveni.com"
PASSWORD="Srini78$$"

# Device data
DEVICE_ID="test-display-001"
DEVICE_NAME="Test Display Unit"
```

## 1. Request Pairing Code

Generate a new pairing code for a device.

```bash
curl -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "test-display-001",
    "nickname": "Test Display Unit",
    "metadata": {
      "hostname": "test-machine",
      "os": "Windows"
    }
  }' | jq .
```

**Save the response code for next steps:**

```bash
# Run this and save the output
PAIRING_RESPONSE=$(curl -s -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "test-display-001",
    "nickname": "Test Display Unit",
    "metadata": {
      "hostname": "test-machine",
      "os": "Windows"
    }
  }')

# Extract the code
PAIRING_CODE=$(echo $PAIRING_RESPONSE | jq -r '.code')
PAIRING_URL=$(echo $PAIRING_RESPONSE | jq -r '.pairingUrl')

echo "Pairing Code: $PAIRING_CODE"
echo "Pairing URL: $PAIRING_URL"
```

**Expected Response:**
```json
{
  "code": "ABC123",
  "qrCode": "data:image/png;base64,...",
  "expiresAt": "2026-01-29T10:35:00.000Z",
  "expiresInSeconds": 300,
  "pairingUrl": "http://localhost:3001/dashboard/devices/pair?code=ABC123"
}
```

---

## 2. Check Pairing Status (Before Completion)

Check the current status of a pairing request.

```bash
# Replace ABC123 with your actual pairing code
curl -X GET http://localhost:3000/api/devices/pairing/status/ABC123 | jq .
```

**Or with variable:**

```bash
curl -X GET http://localhost:3000/api/devices/pairing/status/$PAIRING_CODE | jq .
```

**Expected Response (Pending):**
```json
{
  "status": "pending",
  "expiresAt": "2026-01-29T10:35:00.000Z"
}
```

---

## 3. Access Pairing Page in Web UI

Open the pairing page in your browser:

```bash
# Open in default browser (Linux/Mac)
open "http://localhost:3001/dashboard/devices/pair?code=ABC123"

# Or open with your code (replace ABC123)
open "http://localhost:3001/dashboard/devices/pair?code=$PAIRING_CODE"
```

**Windows:**
```bash
# Open in default browser (Windows)
start "http://localhost:3001/dashboard/devices/pair?code=ABC123"

# Or with variable
start "http://localhost:3001/dashboard/devices/pair?code=$PAIRING_CODE"
```

**Manual steps in browser:**
1. Login with: bro@triveni.com / Srini78$$
2. Code should auto-fill from URL
3. Enter Device Name: "Test Display Unit"
4. Click "Pair Device"

---

## 4. Get Authentication Token

Login to get an authentication token for API requests.

```bash
# Login and save response
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bro@triveni.com",
    "password": "Srini78$$"
  }')

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

echo "Token: $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800
  }
}
```

---

## 5. Complete Pairing (Authenticated)

Complete the pairing process - this is what happens when you click "Pair Device" in the web UI.

```bash
# First get your token (see step 4 above)
TOKEN="your-token-here"

# Complete pairing
curl -X POST http://localhost:3000/api/devices/pairing/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "code": "ABC123",
    "nickname": "Test Display Unit"
  }' | jq .
```

**Or as a complete script:**

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bro@triveni.com",
    "password": "Srini78$$"
  }' | jq -r '.data.token')

# Complete pairing
curl -X POST http://localhost:3000/api/devices/pairing/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"code\": \"$PAIRING_CODE\",
    \"nickname\": \"Test Display Unit\"
  }" | jq .
```

**Expected Response (Success):**
```json
{
  "success": true,
  "display": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nickname": "Test Display Unit",
    "deviceIdentifier": "test-display-001",
    "status": "online"
  }
}
```

---

## 6. Check Pairing Status (After Completion)

Check the status after completing pairing through web UI.

```bash
curl -X GET http://localhost:3000/api/devices/pairing/status/$PAIRING_CODE | jq .
```

**Expected Response (Paired):**
```json
{
  "status": "paired",
  "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "displayId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationId": "org-123"
}
```

---

## 7. Get Active Pairings

List all active (incomplete) pairing requests for your organization.

```bash
# Requires authentication
TOKEN="your-token-here"

curl -X GET http://localhost:3000/api/devices/pairing/active \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected Response:**
```json
[
  {
    "code": "ABC123",
    "nickname": "Test Display Unit",
    "createdAt": "2026-01-29T10:30:00.000Z",
    "expiresAt": "2026-01-29T10:35:00.000Z"
  },
  {
    "code": "XYZ789",
    "nickname": "Another Display",
    "createdAt": "2026-01-29T10:31:00.000Z",
    "expiresAt": "2026-01-29T10:36:00.000Z"
  }
]
```

---

## Complete Test Script

Run this as a single script to test the entire flow:

```bash
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Vizora Pairing Flow Test ===${NC}\n"

# Step 1: Request pairing code
echo -e "${BLUE}Step 1: Requesting pairing code...${NC}"
PAIRING_RESPONSE=$(curl -s -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "test-display-001",
    "nickname": "Test Display Unit",
    "metadata": {
      "hostname": "test-machine",
      "os": "Windows"
    }
  }')

PAIRING_CODE=$(echo $PAIRING_RESPONSE | jq -r '.code')
echo -e "${GREEN}Pairing Code: $PAIRING_CODE${NC}\n"

# Step 2: Check status (pending)
echo -e "${BLUE}Step 2: Checking pairing status (should be pending)...${NC}"
curl -s -X GET http://localhost:3000/api/devices/pairing/status/$PAIRING_CODE | jq .
echo ""

# Step 3: Prompt for web UI completion
echo -e "${BLUE}Step 3: Complete pairing in web UI${NC}"
echo "Open this URL in your browser:"
echo "http://localhost:3001/dashboard/devices/pair?code=$PAIRING_CODE"
echo ""
read -p "Press ENTER after completing pairing in web UI..."

# Step 4: Check status (should be paired)
echo -e "${BLUE}Step 4: Checking pairing status (should be paired)...${NC}"
curl -s -X GET http://localhost:3000/api/devices/pairing/status/$PAIRING_CODE | jq .

echo -e "${GREEN}Test complete!${NC}"
```

Save as `test-pairing.sh` and run:

```bash
bash test-pairing.sh
```

---

## Error Responses

### 400 Bad Request - Device Already Paired

```json
{
  "statusCode": 400,
  "message": "Device is already paired. Please unpair first.",
  "error": "Bad Request"
}
```

### 400 Bad Request - Code Expired

```json
{
  "statusCode": 400,
  "message": "Pairing code has expired",
  "error": "Bad Request"
}
```

### 404 Not Found - Code Not Found

```json
{
  "statusCode": 404,
  "message": "Pairing code not found or expired",
  "error": "Not Found"
}
```

### 401 Unauthorized - Not Logged In

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## Debugging Tips

### Pretty Print JSON Response

```bash
# Using jq (install via: brew install jq or apt-get install jq)
curl -s ... | jq .

# Using python
curl -s ... | python -m json.tool

# Using node
curl -s ... | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0, 'utf-8')), null, 2))"
```

### View Response Headers

```bash
# Show headers only
curl -i -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{...}'

# Show headers and body
curl -i -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Enable Verbose Output

```bash
curl -v -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Save Response to File

```bash
curl -s -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{...}' > pairing-response.json

cat pairing-response.json | jq .
```

---

## Common Issues

### cURL: Connection refused

**Problem**: Services not running

**Solution**:
```bash
# Start middleware
cd vizora/middleware
npm run dev

# Start web app (in another terminal)
cd vizora/web
npm run dev
```

### cURL: jq: command not found

**Solution**: Install jq
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Windows (with Chocolatey)
choco install jq
```

Or remove `| jq .` from commands to see raw JSON.

### "Pairing code has expired"

**Problem**: Code valid for only 5 minutes

**Solution**: Generate a new code and complete within 5 minutes

---

## Advanced Usage

### Batch Testing Multiple Devices

```bash
#!/bin/bash

for i in {1..5}; do
  echo "Pairing device $i..."

  RESPONSE=$(curl -s -X POST http://localhost:3000/api/devices/pairing/request \
    -H "Content-Type: application/json" \
    -d "{
      \"deviceIdentifier\": \"test-device-$i\",
      \"nickname\": \"Test Device $i\",
      \"metadata\": {
        \"hostname\": \"machine-$i\",
        \"os\": \"Windows\"
      }
    }")

  CODE=$(echo $RESPONSE | jq -r '.code')
  echo "Device $i - Pairing Code: $CODE"
  sleep 1
done
```

### Monitor Pairing Status

```bash
#!/bin/bash

CODE="ABC123"  # Replace with your code

echo "Monitoring pairing status for code: $CODE"
echo "Press Ctrl+C to stop"

while true; do
  STATUS=$(curl -s -X GET http://localhost:3000/api/devices/pairing/status/$CODE | jq -r '.status')
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] Status: $STATUS"

  if [ "$STATUS" = "paired" ]; then
    echo "Device paired successfully!"
    break
  fi

  sleep 2
done
```

---

## References

- Full API documentation: See `PAIRING_TEST_GUIDE.md`
- Pairing service code: `/vizora/middleware/src/modules/displays/pairing.service.ts`
- Pairing controller: `/vizora/middleware/src/modules/displays/pairing.controller.ts`
- Web UI: `/vizora/web/src/app/dashboard/devices/pair/page.tsx`
