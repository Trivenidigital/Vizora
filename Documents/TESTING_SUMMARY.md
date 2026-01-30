# Device Pairing Flow - Complete Testing Package

This document summarizes the complete device pairing testing setup and documentation created for the Vizora application.

## What Has Been Created

### 1. Test Scripts

#### Node.js Test Script
**File**: `test-pairing-flow.js`
- **Platform**: Windows, macOS, Linux
- **Requirements**: Node.js installed
- **Usage**: `node test-pairing-flow.js`
- **Features**:
  - Service connectivity check
  - Interactive step-by-step testing
  - Color-coded output
  - Prompts for web UI testing
  - Automatic status verification

#### Bash Test Script
**File**: `test-pairing-flow.sh`
- **Platform**: macOS, Linux
- **Requirements**: bash, curl, jq
- **Usage**: `bash test-pairing-flow.sh`
- **Features**:
  - Service connectivity check
  - Interactive prompts
  - Color-coded output
  - Detailed logging

### 2. Documentation

#### Complete Testing Guide
**File**: `PAIRING_TEST_GUIDE.md`
**Contents**:
- System architecture overview
- API endpoint documentation
- Complete flow walkthrough with diagram
- Test scenarios (5 scenarios included)
- Troubleshooting guide
- Code references
- Security considerations
- Performance metrics

#### cURL Quick Reference
**File**: `PAIRING_CURL_COMMANDS.md`
**Contents**:
- Step-by-step cURL commands
- Command examples with output
- Complete test scripts
- Error response examples
- Debugging tips
- Common issues and solutions
- Advanced usage (batch testing, monitoring)

## Quick Start Guide

### Prerequisites

1. **Middleware API running**:
   ```bash
   cd vizora/middleware
   npm install
   npm run dev
   ```
   - Running on: `http://localhost:3000`

2. **Web App running**:
   ```bash
   cd vizora/web
   npm install
   npm run dev
   ```
   - Running on: `http://localhost:3001`

3. **Test Credentials**:
   - Email: `bro@triveni.com`
   - Password: `Srini78$$`

### Running Tests

#### Option 1: Automated Test Script (Recommended)

```bash
# Windows/macOS/Linux
node test-pairing-flow.js
```

This will:
1. Check service connectivity
2. Request a pairing code
3. Check initial pairing status
4. Prompt you to complete pairing in web UI
5. Verify final pairing status

#### Option 2: Manual cURL Commands

```bash
# 1. Request pairing code
curl -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "test-display-001",
    "nickname": "Test Display Unit",
    "metadata": {"hostname": "test-machine", "os": "Windows"}
  }'

# 2. Open pairing URL in browser
# http://localhost:3001/dashboard/devices/pair?code=ABC123

# 3. Complete pairing in web UI
# - Enter pairing code
# - Enter device name
# - Click "Pair Device"

# 4. Verify pairing status
curl -X GET http://localhost:3000/api/devices/pairing/status/ABC123
```

See `PAIRING_CURL_COMMANDS.md` for detailed commands.

#### Option 3: Manual Browser Test

1. Open `http://localhost:3001` in browser
2. Login with test credentials
3. Navigate to: **Dashboard → Devices → Pair New Device**
4. Get a pairing code from a device (or simulate with API)
5. Enter the code in the pairing form
6. Click "Pair Device"
7. Verify device appears in devices list

## API Endpoints Reference

### Public Endpoints (No Authentication Required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/devices/pairing/request` | POST | Request a pairing code |
| `/api/devices/pairing/status/:code` | GET | Check pairing status |

### Protected Endpoints (Authentication Required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/devices/pairing/complete` | POST | Complete the pairing |
| `/api/devices/pairing/active` | GET | List active pairing requests |

## Key Implementation Details

### Pairing Code

- **Length**: 6 characters
- **Format**: Alphanumeric (excludes ambiguous characters like 0, O, 1, I, l)
- **Generation**: Cryptographically random
- **Expiration**: 5 minutes (300 seconds)
- **Example**: `ABC123`, `XYZ789`, `DEF456`

### QR Code

- **Format**: Data URL (base64 encoded PNG)
- **Content**: Pairing URL with code
- **Example**: `http://localhost:3001/dashboard/devices/pair?code=ABC123`
- **Usage**: Can be scanned by mobile devices

### Device Token

- **Type**: JWT
- **Payload**:
  - `sub`: Display ID
  - `deviceIdentifier`: Unique device ID
  - `organizationId`: Organization ID
  - `type`: "device"
- **Expiration**: 1 year
- **Usage**: Device uses this to authenticate with realtime server

### Database Fields

Display record includes:
- `deviceIdentifier`: Unique device identifier
- `nickname`: User-friendly device name
- `organizationId`: Organization this device belongs to
- `jwtToken`: Device authentication token
- `status`: "online" or "offline"
- `lastHeartbeat`: Last time device connected
- `pairedAt`: When device was paired
- `location`: Physical location (optional)
- `metadata`: Additional device info (hostname, OS, etc.)

## Test Scenarios Covered

### 1. Happy Path - Successful Pairing
- Request code
- Display code
- Enter code in web UI
- Complete pairing
- Verify success

### 2. Expired Code
- Request code
- Wait 5+ minutes
- Attempt to use code
- Verify error handling

### 3. Duplicate Device
- Pair device successfully
- Attempt to pair same device again
- Verify error handling

### 4. Invalid Code
- Try non-existent code
- Try malformed code
- Verify error responses

### 5. Case Insensitivity
- Get code (uppercase)
- Try lowercase
- Try mixed case
- Verify all work correctly

## Verification Checklist

After running tests, verify:

- [ ] Pairing code is 6 characters
- [ ] Code is alphanumeric
- [ ] QR code is generated (valid data URL)
- [ ] Code expires after 5 minutes
- [ ] Web UI auto-fills code from URL query parameter
- [ ] Web UI form validates required fields
- [ ] Device appears in dashboard after pairing
- [ ] Device status is "online"
- [ ] Device can be assigned to playlists
- [ ] Device can be edited (rename, update location)
- [ ] Device can be deleted/unpa ired
- [ ] Error messages are clear and helpful

## Files Overview

```
vizora/
├── test-pairing-flow.js          # Main test script (Node.js)
├── test-pairing-flow.sh          # Test script (Bash)
├── PAIRING_TEST_GUIDE.md         # Complete testing guide
├── PAIRING_CURL_COMMANDS.md      # cURL command reference
├── TESTING_SUMMARY.md            # This file
│
└── vizora/
    ├── middleware/
    │   └── src/modules/displays/
    │       ├── pairing.controller.ts    # API endpoints
    │       ├── pairing.service.ts       # Business logic
    │       ├── dto/
    │       │   ├── request-pairing.dto.ts
    │       │   └── complete-pairing.dto.ts
    │
    ├── web/
    │   └── src/app/dashboard/devices/
    │       └── pair/
    │           └── page.tsx            # Web UI
    │
    └── packages/shared/
        └── src/types/
            └── pairing.types.ts        # Shared types
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Vizora Pairing Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Display Device                Web UI         Middleware   │
│  ┌──────────────┐         ┌──────────┐      ┌──────────┐  │
│  │ Vizora App   │         │ Dashboard │     │ NestJS   │  │
│  │ on Device    │         │ on Port  │     │ on Port  │  │
│  │              │         │ 3001      │     │ 3000     │  │
│  └──────────────┘         └──────────┘     └──────────┘  │
│         │                       │                  │       │
│         │ 1. Request Code       │                  │       │
│         ├──────────────────────────────────────────►      │
│         │                       │                  │       │
│         │          2. Return Code + QR            │       │
│         │◄────────────────────────────────────────┤       │
│         │                       │                  │       │
│         │ 3. Display Code       │                  │       │
│         │ on screen             │                  │       │
│         │                       │                  │       │
│         │               4. Scan QR or Enter Code  │       │
│         │                       ├──────────────────►      │
│         │                       │                  │       │
│         │               5. Login & Submit          │       │
│         │                       ├──────────────────►      │
│         │                       │ Complete Pairing │       │
│         │                       │                  │       │
│         │               6. Success Response       │       │
│         │                       │◄──────────────────┤     │
│         │                       │                  │       │
│         │ 7. Poll Status        │                  │       │
│         ├──────────────────────────────────────────►      │
│         │ (Every 2-5 seconds)   │                  │       │
│         │                       │                  │       │
│         │          8. Return Device Token         │       │
│         │◄────────────────────────────────────────┤       │
│         │                       │                  │       │
│         │ 9. Connect with Token to Realtime Server│       │
│         ├────────────────────────────────────────►        │
│         │ (WebSocket)           │                  │       │
│         │                                          │       │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Services Not Running

```bash
# Check if middleware is running
curl -s http://localhost:3000/health || echo "Middleware not running"

# Check if web app is running
curl -s http://localhost:3001 || echo "Web app not running"
```

### Pairing Code Expired

The code is valid for 5 minutes from generation. If you see "Pairing code has expired":
1. Request a new pairing code
2. Complete pairing within the 5-minute window

### Device Already Paired

If you see "Device is already paired":
1. Use a different `deviceIdentifier` for testing
2. Or unpair the device first through the UI

### Web UI Not Loading

1. Ensure web app is running: `npm run dev` in `vizora/web`
2. Check browser console for errors
3. Verify you're logged in with correct credentials

### API Errors

Check the middleware logs for detailed error information:
- `npm run dev` shows logs in console
- Look for specific error messages
- Verify request body format matches API spec

## Performance Expectations

- **Request pairing code**: < 50ms
- **Check pairing status**: < 10ms
- **Complete pairing**: 100-200ms
- **Active pairings list**: 20-50ms

## Security Notes

The pairing implementation includes:
- ✓ Cryptographically random codes
- ✓ Time-based expiration
- ✓ Authentication requirement for completion
- ✓ JWT tokens for devices
- ✓ Organization-level isolation

Recommendations for production:
- [ ] Rate limit the `/request` endpoint
- [ ] Log all pairing attempts
- [ ] Consider device fingerprinting
- [ ] Implement HTTPS
- [ ] Add device revocation mechanism

## Next Steps

1. **Run the automated test script**:
   ```bash
   node test-pairing-flow.js
   ```

2. **Review the complete testing guide**:
   - Read: `PAIRING_TEST_GUIDE.md`

3. **Try manual cURL commands**:
   - Read: `PAIRING_CURL_COMMANDS.md`

4. **Test all scenarios**:
   - Happy path
   - Error cases
   - Edge cases

5. **Verify in dashboard**:
   - Check paired devices list
   - Assign playlists
   - Monitor device status

## Support & Questions

For issues or questions:
1. Check `PAIRING_TEST_GUIDE.md` troubleshooting section
2. Review `PAIRING_CURL_COMMANDS.md` for specific commands
3. Check middleware logs: `npm run dev` shows console output
4. Check browser console for client-side errors

## Additional Resources

- **Pairing Service**: `/vizora/middleware/src/modules/displays/pairing.service.ts`
- **Pairing Controller**: `/vizora/middleware/src/modules/displays/pairing.controller.ts`
- **Web UI Pairing Page**: `/vizora/web/src/app/dashboard/devices/pair/page.tsx`
- **Data Types**: `/vizora/packages/shared/src/types/pairing.types.ts`
- **Stories/Documentation**: `/vizora/.bmad/stories/story-025-display-app-pairing.md`

---

**Last Updated**: 2026-01-29
**Version**: 1.0
**Status**: Ready for Testing
