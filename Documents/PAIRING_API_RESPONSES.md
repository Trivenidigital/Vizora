# Device Pairing API - Response Examples

Complete examples of all API responses for the device pairing flow.

## 1. Request Pairing Code

### Endpoint
`POST /api/devices/pairing/request`

### Request
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

### Success Response (200 OK)
```json
{
  "code": "ABC123",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAA...",
  "expiresAt": "2026-01-29T10:35:00.000Z",
  "expiresInSeconds": 300,
  "pairingUrl": "http://localhost:3001/dashboard/devices/pair?code=ABC123"
}
```

### Error - Device Already Paired (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Device is already paired. Please unpair first.",
  "error": "Bad Request"
}
```

### Error - Unable to Generate Code (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Unable to generate unique pairing code",
  "error": "Bad Request"
}
```

---

## 2. Check Pairing Status (Pending)

### Endpoint
`GET /api/devices/pairing/status/:code`

### Success Response - Pending (200 OK)
```json
{
  "status": "pending",
  "expiresAt": "2026-01-29T10:35:00.000Z"
}
```

### Success Response - Paired (200 OK)
```json
{
  "status": "paired",
  "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJkZXZpY2VJZGVudGlmaWVyIjoidGVzdC1kaXNwbGF5LTAwMSIsIm9yZ2FuaXphdGlvbklkIjoib3JnLTEyMyIsInR5cGUiOiJkZXZpY2UiLCJpYXQiOjE2NzQ5OTk4MDAsImV4cCI6MTcwNjYxOTA4MH0.abcdef123456...",
  "displayId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationId": "org-123"
}
```

### Error - Code Not Found (404 Not Found)
```json
{
  "statusCode": 404,
  "message": "Pairing code not found or expired",
  "error": "Not Found"
}
```

### Error - Code Expired (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Pairing code has expired",
  "error": "Bad Request"
}
```

---

## 3. Complete Pairing

### Endpoint
`POST /api/devices/pairing/complete`

### Request
```json
{
  "code": "ABC123",
  "nickname": "Test Display Unit"
}
```

### Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Success Response (200 OK) - New Device
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

### Success Response (200 OK) - Existing Device Updated
```json
{
  "success": true,
  "display": {
    "id": "existing-display-id-123",
    "nickname": "Test Display Unit",
    "deviceIdentifier": "test-display-001",
    "status": "online"
  }
}
```

### Error - Code Not Found (404 Not Found)
```json
{
  "statusCode": 404,
  "message": "Pairing code not found or expired",
  "error": "Not Found"
}
```

### Error - Code Expired (400 Bad Request)
```json
{
  "statusCode": 400,
  "message": "Pairing code has expired",
  "error": "Bad Request"
}
```

### Error - Not Authenticated (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## 4. Get Active Pairings

### Endpoint
`GET /api/devices/pairing/active`

### Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response (200 OK) - With Active Pairings
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
    "nickname": "Lobby Display",
    "createdAt": "2026-01-29T10:31:00.000Z",
    "expiresAt": "2026-01-29T10:36:00.000Z"
  },
  {
    "code": "DEF456",
    "nickname": "Conference Room Monitor",
    "createdAt": "2026-01-29T10:32:00.000Z",
    "expiresAt": "2026-01-29T10:37:00.000Z"
  }
]
```

### Success Response (200 OK) - No Active Pairings
```json
[]
```

### Error - Not Authenticated (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## Authentication Endpoint

### Login to Get Token

### Endpoint
`POST /api/auth/login`

### Request
```json
{
  "email": "bro@triveni.com",
  "password": "Srini78$$"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "bro@triveni.com",
      "firstName": "Sri",
      "lastName": "Venkatesh",
      "role": "admin",
      "organizationId": "org-123"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoiYnJvQHRyaXZlbmkuY29tIiwib3JnYW5pemF0aW9uSWQiOiJvcmctMTIzIiwiaWF0IjoxNjc0OTk5ODAwLCJleHAiOjE2NzUwODYyMDB9.abcdef123456...",
    "expiresIn": 604800
  }
}
```

### Error - Invalid Credentials (401 Unauthorized)
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

---

## Device Token JWT Payload

### Structure

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "deviceIdentifier": "test-display-001",
  "organizationId": "org-123",
  "type": "device",
  "iat": 1674999800,
  "exp": 1706619800
}
```

### Decoded Example

```javascript
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "deviceIdentifier": "test-display-001",
    "organizationId": "org-123",
    "type": "device",
    "iat": 1674999800,
    "exp": 1706619800
  },
  "signature": "abcdef123456..."
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `sub` | Subject - Display/Device ID |
| `deviceIdentifier` | Unique device identifier |
| `organizationId` | Organization the device belongs to |
| `type` | Token type - always "device" |
| `iat` | Issued at - Unix timestamp |
| `exp` | Expiration - Unix timestamp (1 year) |

---

## Validation Error Responses

### Invalid Request Body (400 Bad Request)

#### Missing Required Field
```json
{
  "statusCode": 400,
  "message": [
    "deviceIdentifier must be a string",
    "deviceIdentifier should not be empty"
  ],
  "error": "Bad Request"
}
```

#### Invalid Data Type
```json
{
  "statusCode": 400,
  "message": [
    "metadata must be an object"
  ],
  "error": "Bad Request"
}
```

#### Invalid Code Length
```json
{
  "statusCode": 400,
  "message": [
    "code must be exactly 6 characters long"
  ],
  "error": "Bad Request"
}
```

---

## Response Headers

### Standard Response Headers
```
Content-Type: application/json; charset=utf-8
Content-Length: 1234
Connection: keep-alive
Cache-Control: no-cache, no-store, must-revalidate
```

### Authentication Response Headers (includes token)
```
Set-Cookie: authToken=eyJhbGc...; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800
```

---

## Complete Flow Response Sequence

### Step-by-Step

**Step 1: Request Code**
```
→ POST /api/devices/pairing/request
← 200 OK
  {
    "code": "ABC123",
    "qrCode": "data:image/png;base64,...",
    "expiresAt": "2026-01-29T10:35:00.000Z",
    "expiresInSeconds": 300,
    "pairingUrl": "http://localhost:3001/dashboard/devices/pair?code=ABC123"
  }
```

**Step 2: Check Status (Pending)**
```
→ GET /api/devices/pairing/status/ABC123
← 200 OK
  {
    "status": "pending",
    "expiresAt": "2026-01-29T10:35:00.000Z"
  }
```

**Step 3: Login**
```
→ POST /api/auth/login
  {
    "email": "bro@triveni.com",
    "password": "Srini78$$"
  }
← 200 OK
  {
    "success": true,
    "data": {
      "user": {...},
      "token": "eyJhbGc...",
      "expiresIn": 604800
    }
  }
```

**Step 4: Complete Pairing**
```
→ POST /api/devices/pairing/complete
  Authorization: Bearer eyJhbGc...
  {
    "code": "ABC123",
    "nickname": "Test Display Unit"
  }
← 200 OK
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

**Step 5: Check Status (Paired)**
```
→ GET /api/devices/pairing/status/ABC123
← 200 OK
  {
    "status": "paired",
    "deviceToken": "eyJhbGc...",
    "displayId": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "org-123"
  }
```

---

## Error Handling Guide

### HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|-------------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid input, expired code, device already paired |
| 401 | Unauthorized | Missing/invalid authentication token |
| 404 | Not Found | Pairing code not found |
| 500 | Internal Server Error | Server error |

### Error Response Structure

All error responses follow this format:
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Error Type"
}
```

### Common Error Messages

| Message | Status | Cause | Solution |
|---------|--------|-------|----------|
| "Device is already paired" | 400 | Device already exists | Use different device ID or unpair first |
| "Pairing code has expired" | 400 | Code > 5 minutes old | Request new code |
| "Pairing code not found" | 404 | Invalid code | Check code spelling |
| "Unauthorized" | 401 | Not logged in | Login first for /complete endpoint |
| "deviceIdentifier should not be empty" | 400 | Missing field | Include all required fields |

---

## Response Timing

### Typical Response Times

```
Request Pairing Code:           ~30-50ms
Check Pairing Status:           ~5-15ms
Complete Pairing:               ~100-200ms
Get Active Pairings:            ~20-50ms
Login:                          ~150-300ms
```

### Factors Affecting Performance

- Database latency
- QR code generation (when requesting code)
- Network latency
- Server load

---

## Caching Considerations

- **Request Pairing Code**: Not cached (new code each time)
- **Check Status**: Not cached (real-time status)
- **Complete Pairing**: Not cached (one-time action)
- **Auth Token**: Cached in browser (localStorage)

### Cache Headers Sent

```
Cache-Control: no-cache, no-store, must-revalidate
```

All API responses include these headers to prevent caching.

---

## Rate Limiting

Currently no rate limiting implemented on pairing endpoints.

**Recommended for production**:
- 10 requests/minute for `/request` endpoint
- 30 requests/minute for other endpoints
- Per-device or per-IP limiting

---

## Data Storage

### In-Memory Storage
Pairing requests are stored in-memory (service restarts clear them):
```javascript
private pairingRequests = new Map<string, PairingRequest>();
```

### Database Storage
Display records are persisted:
- Stored in Prisma database
- Includes all device metadata
- Survives service restarts

---

## Example cURL Requests with Responses

### Full Request-Response Cycle

```bash
# 1. Request code
curl -v -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "test-001",
    "nickname": "Test",
    "metadata": {"hostname": "test", "os": "Windows"}
  }'

# Response:
# HTTP/1.1 200 OK
# {
#   "code": "ABC123",
#   ...
# }

# 2. Check status
curl -X GET http://localhost:3000/api/devices/pairing/status/ABC123

# Response:
# {
#   "status": "pending",
#   ...
# }

# 3. After pairing in web UI, check again
curl -X GET http://localhost:3000/api/devices/pairing/status/ABC123

# Response:
# {
#   "status": "paired",
#   "deviceToken": "eyJ...",
#   ...
# }
```

---

**Last Updated**: 2026-01-29
**API Version**: 1.0
**Status**: Ready for Testing
