# Device Pairing API Reference
**Status:** ✅ Tested & Operational
**Base URL:** http://localhost:3000/api

---

## Overview

The device pairing system allows display devices to pair with the Vizora backend using a 6-digit code shared via QR code or manual entry. This reference documents all 4 endpoints used in the pairing flow.

---

## Endpoint 1: Request Pairing Code

**Generates a unique 6-digit code for device pairing**

### Basic Info
- **Method:** `POST`
- **Endpoint:** `/devices/pairing/request`
- **Authentication:** None (Public)
- **Rate Limit:** 100 requests/hour per IP

### Request

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

### Request Body

```typescript
{
  // REQUIRED: Unique identifier for the device
  // Format: string (alphanumeric + dashes)
  // Example: "test-display-001", "lobby-screen-01"
  deviceIdentifier: string;

  // OPTIONAL: Human-readable name
  // Default: "Unnamed Display"
  // Example: "Lobby Screen", "Store Front"
  nickname?: string;

  // OPTIONAL: Device metadata
  // Can contain any device-specific information
  metadata?: {
    hostname?: string;
    os?: string;
    macAddress?: string;
    ipAddress?: string;
    resolution?: string;
    [key: string]: any;
  }
}
```

### Response (200 OK)

```json
{
  "code": "M3KGX6",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAAAklEQVR4AewaftIAAAjvSURBVO3B0bUUCw4EwSyd67/LtTiw4qPpNyPIiPQXJOmAQZKOGCTpiEGSjhgk6YhBko4YJOmIQZKOGCTpiEGSjhgk6YhBko4YJOmIQZKOGCTpiEGSjhgk6YhBko4YJOmIQZKOGCTpiEGSjhgk6Ygf/oAk/M3a8jtJ2LTlTEnYtOWJJJDwVFu2SXiiLZ9IwhNt+QZJ+KZBko4YJOmIQZKOGCTpiEGSjhgk6YhBko5If0GPJeFNbdkkYdOWp9ryRBJ+pyx7JDyRhE1bNknYtGWThCeS8DepLZskbNryTRI2bfmmQZKOGCTpiEGSjhgk6YhBko4YJOmI9Bc+LAlbassmCZu2PJGEJ9ryRBJ+py1PJGHTlieSsGnLU0nYtGWTBn3YIElHDJJ0xCBJRwySdMQgSUcMknTEIElH/KA/oi2bJGzasknCE215IgmftjyRhE1bNknYtGWTBn3VIElHDJJ0xCBJRwySdMQgSUcMknTEIElH/KA/oi1PJGF10pZNEjZt2STh2yVh05ZNEjZt2SThH9aWTRI2bfmmQZKOGCTpiEGSjhgk6YhBko4YJOmIQZKOSH/hJ5Kwactj1ZYn2rJJwtesLU8lYdOWTRI2bXkiCb9TW55KwqYt3zRI0hGDJB0xSNIRgyQdMUjSEYMkHTFI0hH/8Acl4Ym2PJWETVueSMKnLU8lYdOWJ5KwacsmCb9TW55oy9esLU8l4ZMGSTpikKQjBkk6YpCkIwZJOmKQpCMGSTri/wMH1LRRJZV5ZWrmAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTAxLTMwVDAzOjE1OjI1WsKYAXgAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDEtMzBUMDM6MTU6MjVawpgBeAAAADl0RVh0U3ZnOkJhc2VVUkkAZmlsZTovLy9bVG1wXS9pbWfreWdvdi9xcmNvZGUuZW5jb2RpbmctUVJD0/sPyQAAAABJRU5ErkJggg==",
  "expiresAt": "2026-01-30T03:15:25.025Z",
  "expiresInSeconds": 300,
  "pairingUrl": "http://localhost:3001/dashboard/devices/pair?code=M3KGX6"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| **code** | string | 6-character pairing code (uppercase alphanumeric) |
| **qrCode** | string | QR code as base64 PNG data URL |
| **expiresAt** | ISO8601 | Timestamp when code expires |
| **expiresInSeconds** | number | Seconds until expiration (always 300) |
| **pairingUrl** | string | Complete URL for web pairing |

### Possible Errors

```json
{
  "statusCode": 400,
  "message": "Device is already paired. Please unpair first.",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "Unable to generate unique pairing code",
  "error": "Bad Request"
}
```

---

## Endpoint 2: Check Pairing Status

**Check if a pairing code has been activated**

### Basic Info
- **Method:** `GET`
- **Endpoint:** `/devices/pairing/status/:code`
- **Authentication:** None (Public)
- **Path Parameter:** `:code` - The 6-character pairing code

### Request

```bash
# Check if code has been paired
curl -X GET http://localhost:3000/api/devices/pairing/status/M3KGX6
```

### Response (Pending Status - 200 OK)

```json
{
  "status": "pending",
  "expiresAt": "2026-01-30T03:15:25.025Z"
}
```

### Response (After Pairing - 200 OK)

```json
{
  "status": "paired",
  "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNTFhOWUxNy1hYTc4LTRiZTMtOGJlZi00N2YxMmE5MTViYjkiLCJkZXZpY2VJZGVudGlmaWVyIjoidGVzdC1kaXNwbGF5LTAwMSIsIm9yZ2FuaXphdGlvbklkIjoiNGNmOGEwYzYtY2IyZS00ODQyLTg1ZGItZmJmZTUzZDVlMTNjIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc2OTc0MjY2NywiZXhwIjoxODAxMjc4NjY3fQ.zrD7HuLRUOufZyA_AGAZtFP1DNsoGRJfFIy8igqkfus",
  "displayId": "f51a9e17-aa78-4be3-8bef-47f12a915bb9",
  "organizationId": "4cf8a0c6-cb2e-4842-85db-fbfe53d5e13c"
}
```

### Response Fields

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| **status** | string | Always | "pending" or "paired" |
| **expiresAt** | ISO8601 | If pending | Code expiration time |
| **deviceToken** | string | If paired | JWT token for device |
| **displayId** | string | If paired | Device record ID |
| **organizationId** | string | If paired | Organization context |

### Possible Errors

```json
{
  "statusCode": 404,
  "message": "Pairing code not found or expired",
  "error": "Not Found"
}
```

---

## Endpoint 3: Complete Device Pairing

**User completes pairing by submitting the code**

### Basic Info
- **Method:** `POST`
- **Endpoint:** `/devices/pairing/complete`
- **Authentication:** Required (Bearer JWT Token)
- **Authorization:** Admin or operator role

### Request

```bash
curl -X POST http://localhost:3000/api/devices/pairing/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "code": "M3KGX6",
    "nickname": "Test Display Unit"
  }'
```

### Request Body

```typescript
{
  // REQUIRED: The 6-character code from pairing request
  // Must be uppercase alphanumeric
  // Length validation: Exactly 6 characters
  code: string;

  // OPTIONAL: Display name/nickname
  // If provided, overrides the device nickname
  // If omitted, uses nickname from pairing request
  nickname?: string;
}
```

### Response (200 OK)

```json
{
  "success": true,
  "display": {
    "id": "f51a9e17-aa78-4be3-8bef-47f12a915bb9",
    "nickname": "Test Display Unit",
    "deviceIdentifier": "test-display-001",
    "status": "online"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| **success** | boolean | Always true on success |
| **display.id** | string | Unique device ID (UUID) |
| **display.nickname** | string | Device display name |
| **display.deviceIdentifier** | string | Device identifier from request |
| **display.status** | string | Device status (always "online" after pairing) |

### Possible Errors

**Invalid Code Format**
```json
{
  "statusCode": 400,
  "message": "code must be 6 characters long",
  "error": "Bad Request"
}
```

**Code Not Found**
```json
{
  "statusCode": 404,
  "message": "Pairing code not found or expired",
  "error": "Not Found"
}
```

**Code Expired**
```json
{
  "statusCode": 400,
  "message": "Pairing code has expired",
  "error": "Bad Request"
}
```

**Not Authenticated**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Insufficient Permissions**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Forbidden"
}
```

---

## Endpoint 4: Get Active Pairings

**List all pending pairing requests for organization**

### Basic Info
- **Method:** `GET`
- **Endpoint:** `/devices/pairing/active`
- **Authentication:** Required (Bearer JWT Token)
- **Authorization:** Admin or operator role

### Request

```bash
curl -X GET http://localhost:3000/api/devices/pairing/active \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200 OK)

```json
[
  {
    "code": "ABC123",
    "nickname": "Lobby Display",
    "createdAt": "2026-01-30T02:45:00.000Z",
    "expiresAt": "2026-01-30T02:50:00.000Z"
  },
  {
    "code": "XYZ789",
    "nickname": "Store Front Screen",
    "createdAt": "2026-01-30T02:48:30.000Z",
    "expiresAt": "2026-01-30T02:53:30.000Z"
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| **code** | string | 6-character pairing code |
| **nickname** | string | Device name |
| **createdAt** | ISO8601 | When code was generated |
| **expiresAt** | ISO8601 | When code expires |

### Possible Errors

**Not Authenticated**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## Authentication

### Getting a Bearer Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bro@triveni.com",
    "password": "Srini78$$"
  }'
```

### Token Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "d70edbf4-a395-41e0-914d-1cd712ac4e5c",
      "email": "bro@triveni.com",
      "role": "admin",
      "organizationId": "4cf8a0c6-cb2e-4842-85db-fbfe53d5e13c"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Using the Token

```bash
# Add to Authorization header
Authorization: Bearer {token}

# Example with curl
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:3000/api/devices/pairing/active
```

---

## Code Format Details

### Code Generation
- **Length:** Exactly 6 characters
- **Character Set:** `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars)
- **Excluded:** I, O, 0, 1 (to avoid confusion)
- **Generation:** Cryptographically random
- **Format:** Always uppercase

### Example Codes
```
✅ Valid:  M3KGX6, ABC123, XYZ789, JKLMNO, 234567
❌ Invalid: abc123 (lowercase), M3KGX (5 chars), M3KGX67 (7 chars)
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Typical Reason |
|------|---------|---------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input, expired code |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Code doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "User-friendly error description",
  "error": "Error Type"
}
```

---

## Rate Limiting

**Request Pairing Code**
- Limit: 100 requests per hour per IP
- When exceeded: 429 Too Many Requests

**Check Status**
- Limit: 1000 requests per hour per IP
- When exceeded: 429 Too Many Requests

**Complete Pairing**
- Limit: 100 requests per hour per user
- When exceeded: 429 Too Many Requests

---

## Code Lifecycle

```
Generation (POST /request)
     ↓
In-Memory Storage (5 minutes)
     ↓
Polling (GET /status) - Device checks every 1 second
     ↓
User Enters Code (Web Dashboard)
     ↓
Completion (POST /complete)
     ↓
Device Record Created
     ↓
Code Auto-Deleted (Security)
     ↓
404 Not Found on subsequent status checks
```

---

## Device Token (After Pairing)

### JWT Payload
```json
{
  "sub": "f51a9e17-aa78-4be3-8bef-47f12a915bb9",
  "deviceIdentifier": "test-display-001",
  "organizationId": "4cf8a0c6-cb2e-4842-85db-fbfe53d5e13c",
  "type": "device",
  "iat": 1769742667,
  "exp": 1801278667
}
```

### Token Expiration
- **Duration:** 365 days
- **Type:** Device-scoped (not user)
- **Use:** WebSocket connections, device API calls

---

## Testing with Curl

### Test 1: Generate Code
```bash
curl -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{"deviceIdentifier":"test-001","nickname":"Test"}'
```

### Test 2: Check Status
```bash
curl http://localhost:3000/api/devices/pairing/status/ABC123
```

### Test 3: Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bro@triveni.com","password":"Srini78$$"}'
```

### Test 4: Complete Pairing
```bash
curl -X POST http://localhost:3000/api/devices/pairing/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"code":"ABC123","nickname":"Test Device"}'
```

---

## Debugging Tips

1. **Check code validity:** Only 6 chars, uppercase
2. **Check token expiry:** Token expires after 7 days
3. **Check code expiry:** Codes expire after 5 minutes
4. **Check organization:** User must be in same org
5. **Check logs:** Enable debug logging in middleware
6. **Check database:** Verify device record created

---

**API Reference Complete ✅**

All 4 endpoints tested and operational.

