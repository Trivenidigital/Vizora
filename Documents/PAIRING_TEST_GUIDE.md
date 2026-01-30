# Vizora Device Pairing Flow - Complete Test Guide

This guide provides comprehensive documentation for testing the complete device pairing flow in the Vizora application.

## Overview

The device pairing flow allows display devices to pair with the Vizora system through a secure code-based process. The flow involves:

1. A display device requesting a pairing code from the middleware
2. The user logging into the web dashboard
3. The user entering the pairing code to complete the pairing
4. The display device receiving a JWT token for authenticated communication

## System Architecture

### Components

- **Middleware API** (Port 3000): Handles pairing logic and device management
- **Web Application** (Port 3001): User interface for entering pairing codes
- **Realtime Server** (Port 3002): WebSocket connection for real-time updates
- **Database**: Stores display and pairing information

### Pairing Service Implementation

**Location**: `/vizora/middleware/src/modules/displays/pairing.service.ts`

Key features:
- 6-character alphanumeric pairing codes (excludes ambiguous characters)
- 5-minute expiration window
- QR code generation for easy mobile scanning
- Automatic cleanup of expired requests
- JWT token generation for paired devices

## Test Credentials

```
Email: bro@triveni.com
Password: Srini78$$
```

## API Endpoints

### 1. Request Pairing Code
**Endpoint**: `POST /api/devices/pairing/request`
**Access**: Public (no authentication required)

**Request Body**:
```json
{
  "deviceIdentifier": "test-display-001",
  "nickname": "Test Display Unit",
  "metadata": {
    "hostname": "test-machine",
    "os": "Windows"
  }
}
```

**Response** (Success - 200):
```json
{
  "code": "ABC123",
  "qrCode": "data:image/png;base64,...",
  "expiresAt": "2026-01-29T10:35:00.000Z",
  "expiresInSeconds": 300,
  "pairingUrl": "http://localhost:3001/dashboard/devices/pair?code=ABC123"
}
```

**Error Cases**:
- Device already paired: `400 Bad Request` - "Device is already paired. Please unpair first."
- Unable to generate unique code: `400 Bad Request` - "Unable to generate unique pairing code"

### 2. Check Pairing Status
**Endpoint**: `GET /api/devices/pairing/status/:code`
**Access**: Public (no authentication required)

**Parameters**:
- `code`: The 6-character pairing code

**Response** (Pending - 200):
```json
{
  "status": "pending",
  "expiresAt": "2026-01-29T10:35:00.000Z"
}
```

**Response** (Paired - 200):
```json
{
  "status": "paired",
  "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "displayId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationId": "org-123"
}
```

**Error Cases**:
- Code not found: `404 Not Found` - "Pairing code not found or expired"
- Code expired: `400 Bad Request` - "Pairing code has expired"

### 3. Complete Pairing
**Endpoint**: `POST /api/devices/pairing/complete`
**Access**: Authenticated (user must be logged in)

**Request Body**:
```json
{
  "code": "ABC123",
  "nickname": "Test Display Unit"
}
```

**Response** (Success - 200):
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

**Error Cases**:
- Code not found: `404 Not Found` - "Pairing code not found or expired"
- Code expired: `400 Bad Request` - "Pairing code has expired"
- Unauthorized: `401 Unauthorized` - User not logged in

### 4. Get Active Pairings
**Endpoint**: `GET /api/devices/pairing/active`
**Access**: Authenticated (user must be logged in)

**Response** (Success - 200):
```json
[
  {
    "code": "ABC123",
    "nickname": "Test Display Unit",
    "createdAt": "2026-01-29T10:30:00.000Z",
    "expiresAt": "2026-01-29T10:35:00.000Z"
  }
]
```

## Testing Procedures

### Quick Start with Test Scripts

#### Option 1: Node.js Script (Recommended for Windows)

```bash
node test-pairing-flow.js
```

#### Option 2: Bash Script (Linux/Mac)

```bash
bash test-pairing-flow.sh
```

### Manual Testing with cURL

#### Test 1: Request Pairing Code

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
  }'
```

**Expected Output**:
- HTTP Status: 200
- Response contains 6-character code
- Response contains QR code (base64 data URL)
- Response contains expiration time (5 minutes from now)

#### Test 2: Check Pairing Status (Pending)

```bash
# Replace ABC123 with actual code from previous step
curl -X GET http://localhost:3000/api/devices/pairing/status/ABC123
```

**Expected Output**:
```json
{
  "status": "pending",
  "expiresAt": "2026-01-29T10:35:00.000Z"
}
```

#### Test 3: Access Web UI Pairing Page

```
URL: http://localhost:3001/dashboard/devices/pair?code=ABC123
```

**Steps**:
1. Navigate to the URL above
2. Should auto-populate the pairing code
3. Enter device name: "Test Display Unit"
4. Leave location empty (optional)
5. Click "Pair Device" button

#### Test 4: Complete Pairing (After Web UI)

The web UI automatically calls this endpoint. To simulate manually:

```bash
# First, you need an authentication token
# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bro@triveni.com",
    "password": "Srini78$$"
  }'

# Extract token from response and use in next request
curl -X POST http://localhost:3000/api/devices/pairing/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "code": "ABC123",
    "nickname": "Test Display Unit"
  }'
```

#### Test 5: Check Pairing Status (Paired)

```bash
curl -X GET http://localhost:3000/api/devices/pairing/status/ABC123
```

**Expected Output**:
```json
{
  "status": "paired",
  "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "displayId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationId": "org-123"
}
```

## Complete Pairing Flow Walkthrough

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Display Device                    Web Browser       Middleware   │
├──────────────┬──────────────────┬──────────────────┬────────────┤
│              │                  │                  │            │
│  Step 1: Request Pairing Code   │                  │            │
│  ┌──────────────────────────────►──────────────────►            │
│  │ POST /api/devices/pairing/request with device info          │
│  │                              │                  │            │
│  │ Response: Code ABC123 + QR   │                  │            │
│  └──────────────────────────────◄──────────────────◄            │
│              │                  │                  │            │
│  Step 2: Display Code           │                  │            │
│  │ Shows ABC123 on screen       │                  │            │
│  │                              │                  │            │
│  │                Step 3: Scan QR or Enter Code    │            │
│  │                              │◄─────────────────┤            │
│  │                              │ Navigate to      │            │
│  │                              │ /pair?code=ABC123│            │
│  │                              │                  │            │
│  │                Step 4: Login & Enter Details    │            │
│  │                              │                  │            │
│  │                │ Email: bro@triveni.com        │            │
│  │                │ Code: ABC123                   │            │
│  │                │ Name: Test Display Unit        │            │
│  │                │                                │            │
│  │                Step 5: Submit Form              │            │
│  │                              │                  │            │
│  │                              │ POST /api/devices/pairing/    │
│  │                              ├─────────────────►│            │
│  │                              │ complete with    │            │
│  │                              │ code & nickname  │            │
│  │                              │                  │            │
│  │                              │ Response: Success│            │
│  │                              │ + Display ID     │            │
│  │                              │◄─────────────────┤            │
│  │                              │                  │            │
│  │ Step 6: Poll Status          │                  │            │
│  │─────────────────────────────────────────────────►            │
│  │ GET /api/devices/pairing/status/ABC123                       │
│  │                              │                  │            │
│  │ Response: Status "paired"    │                  │            │
│  │ + Device Token               │                  │            │
│  │◄─────────────────────────────────────────────────            │
│  │                              │                  │            │
│  │ Step 7: Use Device Token     │                  │            │
│  │ Connect to realtime server   │                  │            │
│  │ with JWT token               │                  │            │
│  └──────────────────────────────┴──────────────────┴────────────┘
```

### Detailed Steps

#### Step 1: Display Requests Pairing Code
- **Actor**: Display Device
- **Action**: Sends POST request to `/api/devices/pairing/request`
- **Includes**: Device ID, nickname, metadata (hostname, OS)
- **Response**:
  - Pairing code (6 chars)
  - QR code (data URL)
  - Expiration time (5 minutes)
  - Pairing URL for web UI

#### Step 2: Display Shows Code
- **Actor**: Display Device
- **Action**: Shows the pairing code and QR code on the device screen
- **Purpose**: User can scan QR or manually enter code

#### Step 3: User Accesses Web UI
- **Actor**: User in Web Browser
- **Action**:
  - Either scans QR code (opens pairing URL directly)
  - Or manually navigates to dashboard and enters code
- **URL**: `http://localhost:3001/dashboard/devices/pair?code=ABC123`
- **Note**: Code auto-fills if accessed via QR scan

#### Step 4: User Completes Pairing Form
- **Actor**: User in Web Browser
- **Required Fields**:
  - Pairing Code: ABC123 (auto-filled from URL param)
  - Device Name: "Test Display Unit"
- **Optional Fields**:
  - Location: Physical location of the device
- **Note**: User must be logged in to proceed

#### Step 5: Submit Pairing Request
- **Actor**: Web UI (via JavaScript)
- **Action**: Sends POST to `/api/devices/pairing/complete`
- **Includes**:
  - Pairing code
  - Device nickname
  - User's authentication token (from login)
- **Backend Creates**:
  - Display record in database (if new)
  - JWT token for device
  - Links device to organization

#### Step 6: Display Polls for Pairing Status
- **Actor**: Display Device
- **Action**: Polls GET `/api/devices/pairing/status/ABC123`
- **Polling**:
  - Every 2-5 seconds
  - Stops after 5 minutes (expiration)
  - Or stops after successful pairing
- **Response**: Status = "paired"

#### Step 7: Device Receives Token and Connects
- **Actor**: Display Device
- **Action**:
  - Extracts JWT token from status response
  - Connects to realtime server on port 3002
  - Sends JWT token in WebSocket connection
- **Result**: Device is now connected and ready to receive commands

## Test Scenarios

### Scenario 1: Happy Path - Successful Pairing

**Goal**: Complete successful device pairing

**Steps**:
1. Run test script: `node test-pairing-flow.js`
2. Choose "y" to test web UI
3. Follow UI instructions
4. Verify pairing status changes to "paired"

**Verification**:
- [ ] Pairing code generated successfully
- [ ] Code is 6 characters
- [ ] QR code is valid
- [ ] Web UI auto-fills code from URL
- [ ] Device appears in Dashboard → Devices
- [ ] Device status is "online"
- [ ] Pairing status API returns "paired" with token

### Scenario 2: Expired Code

**Goal**: Test pairing code expiration

**Steps**:
1. Run test script and get pairing code
2. Wait 5+ minutes
3. Try to use the code

**Verification**:
- [ ] Status endpoint returns "Pairing code has expired"
- [ ] Complete pairing endpoint returns error
- [ ] Cannot pair with expired code

### Scenario 3: Duplicate Device ID

**Goal**: Test preventing duplicate device pairing

**Steps**:
1. Pair a device successfully
2. Try to request pairing with same device ID

**Verification**:
- [ ] Request endpoint returns error: "Device is already paired. Please unpair first."
- [ ] Cannot request new pairing for already-paired device

### Scenario 4: Invalid Pairing Code

**Goal**: Test error handling for invalid codes

**Steps**:
1. Try to complete pairing with non-existent code
2. Try to check status with invalid code

**Verification**:
- [ ] Status endpoint returns 404: "Pairing code not found or expired"
- [ ] Complete endpoint returns error

### Scenario 5: Code is Case-Insensitive

**Goal**: Test that codes work regardless of case

**Steps**:
1. Get pairing code (e.g., ABC123)
2. Try entering lowercase: abc123
3. Try mixed case: AbC123

**Verification**:
- [ ] Web UI auto-converts to uppercase
- [ ] All case variants work correctly

## Troubleshooting

### Issue: "Middleware API is not responding"

**Solution**:
```bash
cd vizora/middleware
npm install
npm run dev
```

Ensure middleware is running on port 3000.

### Issue: "Web App is not responding"

**Solution**:
```bash
cd vizora/web
npm install
npm run dev
```

Ensure web app is running on port 3001.

### Issue: "Pairing code not found or expired"

**Possible Causes**:
- Code was typed incorrectly
- Code expired (5-minute window)
- Different code was generated

**Solution**:
- Generate new pairing code
- Complete pairing within 5 minutes

### Issue: "Device is already paired"

**Possible Causes**:
- Device ID already exists in system
- Device wasn't unpa ired before retry

**Solution**:
- Use different device ID for test
- Or unpair the device first

### Issue: "Pairing code has expired"

**Solution**:
- Request new pairing code
- Complete pairing within 5-minute window
- Increase PAIRING_EXPIRY_MS in pairing.service.ts if needed

### Issue: Web UI shows "Pairing failed"

**Possible Causes**:
- Not logged in
- Wrong pairing code
- Code expired
- Server error

**Solution**:
1. Check browser console for error details
2. Verify you're logged in
3. Verify code is correct and not expired
4. Check middleware logs for server errors

## Code References

### Pairing Service
**File**: `/vizora/middleware/src/modules/displays/pairing.service.ts`

Key methods:
- `requestPairingCode()` - Generates pairing code
- `checkPairingStatus()` - Returns pairing status
- `completePairing()` - Completes the pairing process
- `getActivePairings()` - Lists active pairing requests
- `generatePairingCode()` - Creates unique 6-char code
- `cleanupExpiredRequests()` - Removes expired codes

### Pairing Controller
**File**: `/vizora/middleware/src/modules/displays/pairing.controller.ts`

Endpoints:
- POST `/devices/pairing/request` - Request code (public)
- GET `/devices/pairing/status/:code` - Check status (public)
- POST `/devices/pairing/complete` - Complete pairing (authenticated)
- GET `/devices/pairing/active` - Get active requests (authenticated)

### Web UI Page
**File**: `/vizora/web/src/app/dashboard/devices/pair/page.tsx`

Features:
- Auto-fill code from URL query parameter
- Display QR code for mobile scanning
- Form validation
- Error handling and toast notifications
- Redirect to devices list on success

### Data Types
**File**: `/vizora/packages/shared/src/types/pairing.types.ts`

Types:
- `PairingStatus` enum
- `Pairing` interface
- `CreatePairingDto`
- `ValidatePairingDto`

## Performance Metrics

### Typical Response Times

- **Request Pairing Code**: < 50ms
- **Check Pairing Status**: < 10ms
- **Complete Pairing**: 100-200ms (includes DB operations)

### Limits

- **Code Length**: 6 characters (alphanumeric)
- **Expiration Time**: 5 minutes (300 seconds)
- **Max Concurrent Codes**: Unlimited (in-memory storage)
- **Cleanup Interval**: 1 minute

## Security Considerations

### Current Implementation

1. **Code Generation**: Cryptographically random alphanumeric codes
2. **Expiration**: 5-minute time limit
3. **Authentication**: Complete pairing requires user login
4. **JWT Tokens**: Generated for devices (1-year expiration)
5. **Organization Isolation**: Devices linked to organizations

### Recommendations

1. Rate limit the `/request` endpoint to prevent code spam
2. Log all pairing attempts for audit trail
3. Implement device fingerprinting/validation
4. Consider shorter token expiration for devices
5. Add device revocation mechanism
6. Implement HTTPS only for production

## Additional Resources

- Device schema: `/vizora/packages/database/schema.prisma`
- Pairing tests: `/vizora/middleware/src/modules/displays/pairing.controller.spec.ts`
- Display app integration: `/vizora/.bmad/stories/story-025-display-app-pairing.md`

## Support

For issues or questions about the pairing flow:
1. Check troubleshooting section above
2. Review code references
3. Check middleware logs
4. Check browser console for errors
5. Contact development team
