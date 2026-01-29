# 🧪 Vizora Manual Testing Guide

**Version:** 1.0  
**Date:** January 27, 2026  
**Status:** Comprehensive Manual Testing Protocol  
**For:** Testers, QA Engineers, Clawdbot

---

## 📋 Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Test Environment](#test-environment)
3. [Authentication & User Management](#1-authentication--user-management)
4. [Organization Management](#2-organization-management)
5. [Content Management](#3-content-management)
6. [Playlist Management](#4-playlist-management)
7. [Schedule Management](#5-schedule-management)
8. [Display/Device Management](#6-displaydevice-management)
9. [Device Pairing & WebSocket](#7-device-pairing--websocket)
10. [Real-time Updates](#8-real-time-updates)
11. [Content Streaming & Playback](#9-content-streaming--playback)
12. [Health & Monitoring](#10-health--monitoring)
13. [Security Testing](#11-security-testing)
14. [Performance Testing](#12-performance-testing)
15. [Error Handling](#13-error-handling)
16. [Multi-Tenant Isolation](#14-multi-tenant-isolation)
17. [Test Results Template](#test-results-template)

---

## Pre-Testing Setup

### Required Tools
- **HTTP Client:** Postman, Insomnia, or `curl`
- **WebSocket Client:** Socket.IO client library, wscat, or Postman
- **Browser:** Chrome/Firefox DevTools
- **Database Client:** pgAdmin, DBeaver, or `psql`
- **Storage:** MinIO Browser or AWS CLI

### Environment Variables
```bash
# Middleware
MIDDLEWARE_URL=http://localhost:3000
JWT_SECRET=<from .env>

# Realtime
REALTIME_URL=http://localhost:3001
DEVICE_JWT_SECRET=<from .env>

# Database
DATABASE_URL=<postgres connection string>
MONGO_URL=<mongodb connection string>
REDIS_URL=<redis connection string>
```

### Starting Services
```bash
# 1. Start Docker dependencies
cd C:\Projects\vizora\vizora
docker-compose up -d

# 2. Verify all services are healthy
docker ps

# 3. Start middleware
cd middleware
npm run dev
# or
pnpm nx serve middleware

# 4. Start realtime service
cd realtime
npm run dev
# or
pnpm nx serve realtime

# 5. Start web dashboard (optional)
cd web
npm run dev
# or
pnpm nx dev web
```

### Health Check
```bash
# Verify middleware is running
curl http://localhost:3000/api/health

# Expected: {"status":"ok"}

# Verify realtime is running
curl http://localhost:3001/health

# Expected: {"status":"ok","timestamp":"..."}
```

---

## Test Environment

### Base URLs
- **Middleware API:** `http://localhost:3000/api`
- **Realtime WebSocket:** `ws://localhost:3001`
- **Web Dashboard:** `http://localhost:4200`

### API Response Format Notes

⚠️ **Important:** The API uses inconsistent response formats:

1. **Auth endpoints** return data wrapped in a `data` object:
   ```json
   {
     "success": true,
     "data": {
       "token": "...",
       "user": {...},
       "organization": {...}
     }
   }
   ```

2. **Most other endpoints** return data directly (not wrapped):
   ```json
   {
     "id": "...",
     "name": "...",
     ...
   }
   ```

When following tests, adjust expectations based on the endpoint being tested.

### Test Data Preparation
Create a test data file to track credentials across tests:

```json
{
  "testSession": {
    "timestamp": "2026-01-27T14:00:00Z",
    "tester": "YourName"
  },
  "users": {
    "org1": {
      "email": "test-org1@example.com",
      "password": "Test123!@#",
      "accessToken": "",
      "refreshToken": "",
      "organizationId": ""
    },
    "org2": {
      "email": "test-org2@example.com",
      "password": "Test456!@#",
      "accessToken": "",
      "refreshToken": "",
      "organizationId": ""
    }
  },
  "content": {},
  "playlists": {},
  "devices": {}
}
```

---

## 1. Authentication & User Management

### Test 1.1: User Registration

**Objective:** Verify new user can register successfully

**Steps:**
1. Send POST request to `/api/auth/register`
2. Body:
   ```json
   {
     "email": "test-org1@example.com",
     "password": "Test123!@#",
     "firstName": "Test",
     "lastName": "User",
     "organizationName": "Test Organization 1"
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response contains `accessToken` (as `token`), `user`, `organization` (wrapped in `data` object)
- ✅ `data.token` is a valid JWT (decode and verify structure)
- ✅ `data.user.email` matches input
- ✅ `data.user.role` is `admin`
- ✅ `data.organization.name` matches `organizationName`
- ✅ Database: New user created in `users` table
- ✅ Database: New organization created in `organizations` table
- ✅ Database: Audit log entry created for registration

**Save for later:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "userId": "...",
  "organizationId": "..."
}
```

---

### Test 1.2: User Login

**Objective:** Verify existing user can log in

**Steps:**
1. Send POST request to `/api/auth/login`
2. Body:
   ```json
   {
     "email": "test-org1@example.com",
     "password": "Test123!@#"
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response contains `accessToken`, `refreshToken`
- ✅ Tokens are valid JWTs
- ✅ Database: Audit log entry created for login

---

### Test 1.3: Invalid Login Credentials

**Objective:** Verify proper error handling for wrong password

**Steps:**
1. Send POST request to `/api/auth/login`
2. Body:
   ```json
   {
     "email": "test-org1@example.com",
     "password": "WrongPassword123"
   }
   ```

**Expected Results:**
- ✅ Status: `401 Unauthorized`
- ✅ Response: `{"message": "Invalid credentials"}`
- ✅ No tokens returned
- ✅ Database: Failed login attempt logged

---

### Test 1.4: Token Refresh

**Objective:** Verify JWT refresh mechanism works

**Steps:**
1. Send POST request to `/api/auth/refresh`
2. Headers: `Authorization: Bearer <refreshToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response contains new `accessToken`, `refreshToken`
- ✅ Old tokens are invalidated
- ✅ New tokens are valid JWTs with updated expiry

---

### Test 1.5: Logout

**Objective:** Verify user can log out

**Steps:**
1. Send POST request to `/api/auth/logout`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response: `{"message": "Logged out successfully"}`
- ✅ Database: Audit log entry created for logout
- ✅ Subsequent API calls with old token return `401 Unauthorized`

---

### Test 1.6: Protected Endpoint Without Token

**Objective:** Verify authentication guard blocks unauthenticated requests

**Steps:**
1. Send GET request to `/api/users/me`
2. No Authorization header

**Expected Results:**
- ✅ Status: `401 Unauthorized`
- ✅ Response: `{"message": "Unauthorized"}`

---

### Test 1.7: Rate Limiting on Login

**Objective:** Verify brute force protection

**Steps:**
1. Send 10 rapid POST requests to `/api/auth/login` with wrong password
2. Check responses

**Expected Results:**
- ✅ First 4 requests: `401 Unauthorized`
- ✅ 5th+ requests: `429 Too Many Requests`
- ✅ Response: `{"message": "Too many requests"}`
- ✅ User must wait before retrying

---

## 2. Organization Management

### Test 2.1: Get Current Organization

**Objective:** Verify user can retrieve their organization

**Steps:**
1. Send GET request to `/api/organizations/<organizationId>` (use organization ID from registration)
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response contains organization details (returned directly, not wrapped in `data`)
- ✅ `id`, `name`, `createdAt`, `updatedAt` present

**Note:** The endpoint `/api/organizations/me` returns 403 Forbidden. Use the specific organization ID instead.

---

### Test 2.2: Update Organization Name

**Objective:** Verify organization owner can update org details

**Steps:**
1. Send PATCH request to `/api/organizations/<orgId>`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "name": "Updated Test Organization 1"
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response shows updated name
- ✅ Database: Organization name updated
- ✅ Database: Audit log entry created

---

### Test 2.3: Multi-Tenant Isolation (Organization)

**Objective:** Verify Org 1 cannot access Org 2's data

**Steps:**
1. Create second user for Org 2 (repeat Test 1.1)
2. Try to GET `/api/organizations/<org2Id>` using Org 1 token

**Expected Results:**
- ✅ Status: `403 Forbidden` or `404 Not Found`
- ✅ No data from Org 2 leaked

---

## 3. Content Management

### Test 3.1: Upload Image Content

**Objective:** Verify image upload to storage

**Steps:**
1. Send POST request to `/api/content`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body (multipart/form-data):
   ```
   type: "image"
   name: "Test Image 1"
   duration: 10
   file: <select a .jpg or .png file>
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response contains:
  - `id`, `name`, `type: "image"`, `url`, `storageKey`
- ✅ `url` is a valid MinIO/S3 URL
- ✅ MinIO: File uploaded successfully to bucket
- ✅ Database: Content record created with `organizationId`

**Save:**
```json
{
  "imageContentId": "...",
  "imageUrl": "..."
}
```

---

### Test 3.2: Upload Video Content

**Objective:** Verify video upload to storage

**Steps:**
1. Send POST request to `/api/content`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body (multipart/form-data):
   ```
   type: "video"
   name: "Test Video 1"
   duration: 30
   file: <select a .mp4 file>
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response contains valid video content
- ✅ `type: "video"`
- ✅ MinIO: Video file uploaded
- ✅ Database: Content record created

**Save:**
```json
{
  "videoContentId": "...",
  "videoUrl": "..."
}
```

---

### Test 3.3: Create URL Content

**Objective:** Verify URL content (web page) creation

**Steps:**
1. Send POST request to `/api/content`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body (JSON):
   ```json
   {
     "type": "url",
     "name": "Google Homepage",
     "url": "https://google.com",
     "duration": 20
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response: `type: "url"`, `url: "https://google.com"`
- ✅ No file uploaded to storage
- ✅ Database: Content record created

**Save:**
```json
{
  "urlContentId": "..."
}
```

---

### Test 3.4: Create HTML Content

⚠️ **SKIP THIS TEST** - HTML content type is not currently supported by the API.

**Status:** NOT IMPLEMENTED  
**Error:** API requires `url` field for all content types, `htmlContent` field is not accepted.

**For Future Implementation:**
When HTML content is supported, use this request:
```json
{
  "type": "html",
  "name": "Custom HTML Widget",
  "htmlContent": "<h1>Hello Vizora!</h1><p>This is custom HTML</p>",
  "duration": 15
}
```

**Workaround:** Use `type: "url"` instead with a data URL or hosted HTML page.

**Save:**
```json
{
  "htmlContentId": "..."
}
```

---

### Test 3.5: List All Content

**Objective:** Verify user can retrieve all their content

**Steps:**
1. Send GET request to `/api/content`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response is an array with 4 items (image, video, URL, HTML)
- ✅ Only content from current organization shown
- ✅ Each item has: `id`, `name`, `type`, `duration`, `createdAt`

---

### Test 3.6: Get Single Content by ID

**Objective:** Verify retrieving specific content

**Steps:**
1. Send GET request to `/api/content/<imageContentId>`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response matches uploaded image details

---

### Test 3.7: Update Content Metadata

**Objective:** Verify content can be updated

**Steps:**
1. Send PATCH request to `/api/content/<imageContentId>`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "name": "Updated Image Name",
     "duration": 15
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response shows updated name and duration
- ✅ Database: Content updated

---

### Test 3.8: Delete Content

**Objective:** Verify content deletion

**Steps:**
1. Send DELETE request to `/api/content/<htmlContentId>`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK` or `204 No Content`
- ✅ GET `/api/content/<htmlContentId>` returns `404`
- ✅ Database: Content record deleted
- ✅ MinIO: File removed (if applicable)

---

### Test 3.9: Multi-Tenant Isolation (Content)

**Objective:** Verify Org 1 cannot access Org 2's content

**Steps:**
1. Upload content as Org 2
2. Try to GET `/api/content/<org2ContentId>` using Org 1 token

**Expected Results:**
- ✅ Status: `403 Forbidden` or `404 Not Found`
- ✅ No content data leaked

---

## 4. Playlist Management

### Test 4.1: Create Playlist

**Objective:** Verify playlist creation with multiple content items

**Steps:**
1. Send POST request to `/api/playlists`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "name": "Test Playlist 1",
     "items": [
       {
         "contentId": "<imageContentId>",
         "order": 0,
         "duration": 10
       },
       {
         "contentId": "<videoContentId>",
         "order": 1,
         "duration": 30
       },
       {
         "contentId": "<urlContentId>",
         "order": 2,
         "duration": 20
       }
     ]
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response contains: `id`, `name`, `items` array
- ✅ `items` array has 3 items in correct order
- ✅ Database: Playlist created
- ✅ Database: PlaylistItems created with correct `order` and `contentId`

**Save:**
```json
{
  "playlist1Id": "..."
}
```

---

### Test 4.2: List All Playlists

**Objective:** Verify user can retrieve all playlists

**Steps:**
1. Send GET request to `/api/playlists`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response is an array with at least 1 playlist
- ✅ Only playlists from current organization shown

---

### Test 4.3: Get Playlist by ID

**Objective:** Verify retrieving specific playlist with items

**Steps:**
1. Send GET request to `/api/playlists/<playlist1Id>`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response includes playlist details and `items` array
- ✅ Items are ordered by `order` field (0, 1, 2)
- ✅ Each item includes related content details

---

### Test 4.4: Update Playlist Items

**Objective:** Verify reordering and updating playlist items

**Steps:**
1. Send PATCH request to `/api/playlists/<playlist1Id>`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "name": "Updated Playlist",
     "items": [
       {
         "contentId": "<videoContentId>",
         "order": 0,
         "duration": 25
       },
       {
         "contentId": "<imageContentId>",
         "order": 1,
         "duration": 12
       }
     ]
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response shows updated name and reordered items
- ✅ Database: Playlist items updated
- ✅ Old order 2 item removed

---

### Test 4.5: Delete Playlist

**Objective:** Verify playlist deletion

**Steps:**
1. Create a new playlist first
2. Send DELETE request to `/api/playlists/<newPlaylistId>`
3. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK` or `204 No Content`
- ✅ GET `/api/playlists/<newPlaylistId>` returns `404`
- ✅ Database: Playlist and associated items deleted

---

### Test 4.6: Multi-Tenant Isolation (Playlists)

**Objective:** Verify Org 1 cannot access Org 2's playlists

**Steps:**
1. Create playlist as Org 2
2. Try to GET `/api/playlists/<org2PlaylistId>` using Org 1 token

**Expected Results:**
- ✅ Status: `403 Forbidden` or `404 Not Found`

---

## 5. Schedule Management

### Test 5.1: Create Schedule

**Objective:** Verify scheduling playlists for specific time periods

**Steps:**
1. Send POST request to `/api/schedules`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "name": "Morning Schedule",
     "playlistId": "<playlist1Id>",
     "startTime": "09:00",
     "endTime": "12:00",
     "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday"],
     "priority": 1
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response contains schedule details
- ✅ `startTime`, `endTime`, `daysOfWeek`, `priority` match input
- ✅ Database: Schedule created

**Save:**
```json
{
  "schedule1Id": "..."
}
```

---

### Test 5.2: Create Overlapping Schedule

**Objective:** Verify priority-based schedule resolution

**Steps:**
1. Send POST request to `/api/schedules`
2. Body:
   ```json
   {
     "name": "Afternoon Schedule",
     "playlistId": "<playlist1Id>",
     "startTime": "11:00",
     "endTime": "14:00",
     "daysOfWeek": ["monday", "wednesday", "friday"],
     "priority": 2
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Higher priority (2) should override lower priority (1) during overlap

**Save:**
```json
{
  "schedule2Id": "..."
}
```

---

### Test 5.3: List All Schedules

**Objective:** Verify retrieving all schedules

**Steps:**
1. Send GET request to `/api/schedules`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response is an array with at least 2 schedules
- ✅ Only schedules from current organization

---

### Test 5.4: Update Schedule

**Objective:** Verify modifying schedule times

**Steps:**
1. Send PATCH request to `/api/schedules/<schedule1Id>`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "startTime": "08:00",
     "endTime": "13:00"
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response shows updated times
- ✅ Database: Schedule updated

---

### Test 5.5: Delete Schedule

**Objective:** Verify schedule deletion

**Steps:**
1. Send DELETE request to `/api/schedules/<schedule2Id>`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK` or `204 No Content`
- ✅ GET `/api/schedules/<schedule2Id>` returns `404`
- ✅ Database: Schedule deleted

---

## 6. Display/Device Management

### Test 6.1: Create Display

**Objective:** Verify creating a display (device) record

**Steps:**
1. Send POST request to `/api/displays`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "deviceId": "TEST-DEVICE-001",
     "name": "Lobby Display",
     "location": "Main Lobby",
     "orientation": "landscape",
     "resolution": "1920x1080"
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response contains: `id`, `deviceIdentifier` (stored as), `nickname` (stored as), `location`, `status: "offline"`
- ✅ Database: Display created with `organizationId`
- ✅ Initial status is `offline` (not paired yet)

**Note:** The API accepts `deviceId` and `name` in the request, but stores them as `deviceIdentifier` and `nickname` in the database.

**Save:**
```json
{
  "display1Id": "...",
  "deviceIdentifier": "TEST-DEVICE-001"
}
```

---

### Test 6.2: List All Displays

**Objective:** Verify retrieving all displays

**Steps:**
1. Send GET request to `/api/displays`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response is an array with at least 1 display
- ✅ Only displays from current organization

---

### Test 6.3: Get Display by ID

**Objective:** Verify retrieving specific display

**Steps:**
1. Send GET request to `/api/displays/<display1Id>`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response includes display details, status, last heartbeat

---

### Test 6.4: Assign Playlist to Display

**Objective:** Verify assigning a playlist to a display

**Steps:**
1. Send PATCH request to `/api/displays/<display1Id>`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "currentPlaylistId": "<playlist1Id>"
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response shows `currentPlaylistId` updated
- ✅ Database: Display playlist assignment updated
- ✅ Returns 404 if playlist doesn't exist or doesn't belong to your organization

**Note:** The `currentPlaylistId` field has been added to the Display model. Set to `null` to unassign.

---

### Test 6.5: Update Display Metadata

**Objective:** Verify updating display details

**Steps:**
1. Send PATCH request to `/api/displays/<display1Id>`
2. Headers: `Authorization: Bearer <accessToken>`
3. Body:
   ```json
   {
     "nickname": "Updated Lobby Display",
     "location": "Entrance Hall"
   }
   ```

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response shows updated nickname and location

---

### Test 6.6: Generate Device JWT Token

**Objective:** Verify device pairing token generation

**Steps:**
1. Send POST request to `/api/displays/<display1Id>/pair`
2. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response contains:
  - `pairingToken`: A JWT token
  - `expiresIn`: "30d" (device tokens last 30 days)
  - `displayId`: Display ID
  - `deviceIdentifier`: Device identifier
- ✅ Decode token and verify:
  - `sub` = display ID
  - `deviceIdentifier` matches
  - `organizationId` matches
  - `type: "device"`
- ✅ Database: Display updated with JWT token and `pairedAt` timestamp
- ✅ Display status changes to "pairing"

**Save:**
```json
{
  "deviceToken": "..."
}
```

---

### Test 6.7: Delete Display

**Objective:** Verify display deletion

**Steps:**
1. Create a new display
2. Send DELETE request to `/api/displays/<newDisplayId>`
3. Headers: `Authorization: Bearer <accessToken>`

**Expected Results:**
- ✅ Status: `200 OK` or `204 No Content`
- ✅ GET `/api/displays/<newDisplayId>` returns `404`
- ✅ Database: Display deleted

---

## 7. Device Pairing & WebSocket

### Test 7.1: Device WebSocket Connection (Valid Token)

**Objective:** Verify device can connect to WebSocket with valid JWT

**Prerequisites:** Have `deviceToken` from Test 6.6

**Steps:**
1. Open WebSocket client (Socket.IO client)
2. Connect to `ws://localhost:3001`
3. Send authentication:
   ```javascript
   const socket = io('http://localhost:3001', {
     auth: {
       token: '<deviceToken>'
     }
   });
   ```

**Expected Results:**
- ✅ Connection succeeds (no disconnect)
- ✅ Server emits `config` event with:
  ```json
  {
    "heartbeatInterval": 15000,
    "cacheSize": 524288000,
    "autoUpdate": true
  }
  ```
- ✅ Device joins rooms: `device:<displayId>` and `org:<organizationId>`
- ✅ Redis: Device status set to `online`
- ✅ Realtime logs: "Device connected: <displayId>"
- ✅ WebSocket broadcasts to org: `device:status` event with `status: "online"`

---

### Test 7.2: Device WebSocket Connection (No Token)

**Objective:** Verify unauthenticated connection is rejected

**Steps:**
1. Try to connect to `ws://localhost:3001`
2. No auth token provided

**Expected Results:**
- ✅ Connection immediately disconnected
- ✅ Realtime logs: "Connection rejected: No token provided"

---

### Test 7.3: Device WebSocket Connection (Invalid Token)

**Objective:** Verify invalid token is rejected

**Steps:**
1. Try to connect with invalid/expired token
2. Send authentication:
   ```javascript
   const socket = io('http://localhost:3001', {
     auth: {
       token: 'invalid.jwt.token'
     }
   });
   ```

**Expected Results:**
- ✅ Connection immediately disconnected
- ✅ Realtime logs: "Connection error: jwt malformed" or similar

---

### Test 7.4: Device Heartbeat

**Objective:** Verify device can send heartbeat

**Prerequisites:** Connected device from Test 7.1

**Steps:**
1. Emit `heartbeat` event:
   ```javascript
   socket.emit('heartbeat', {
     metrics: {
       cpuUsage: 45.2,
       memoryUsage: 62.8,
       temperature: 55,
       diskUsage: 30.5
     },
     currentContent: {
       contentId: '<imageContentId>',
       playlistId: '<playlist1Id>',
       playbackPosition: 5.2
     }
   });
   ```
2. Wait for response

**Expected Results:**
- ✅ Server responds with acknowledgment:
  ```json
  {
    "success": true,
    "nextHeartbeatIn": 15000,
    "commands": [],
    "timestamp": "2026-01-27T14:30:00.000Z"
  }
  ```
- ✅ Redis: Device status updated with metrics and `lastHeartbeat`
- ✅ Prometheus: Heartbeat metrics recorded
- ✅ Database/ClickHouse: Heartbeat logged for analytics

---

### Test 7.5: Device Disconnection

**Objective:** Verify graceful disconnect handling

**Prerequisites:** Connected device from Test 7.1

**Steps:**
1. Disconnect the WebSocket client:
   ```javascript
   socket.disconnect();
   ```

**Expected Results:**
- ✅ Server logs: "Device disconnected: <displayId>"
- ✅ Redis: Device status updated to `offline`
- ✅ WebSocket broadcasts to org: `device:status` event with `status: "offline"`
- ✅ Prometheus: Connection metric decremented

---

### Test 7.6: Playlist Request

**Objective:** Verify device can request its current playlist

**Prerequisites:** Connected device from Test 7.1, display has assigned playlist

**Steps:**
1. Emit `playlist:request` event:
   ```javascript
   socket.emit('playlist:request', {});
   ```
2. Wait for response

**Expected Results:**
- ✅ Server responds with:
  ```json
  {
    "success": true,
    "playlist": {
      "id": "...",
      "name": "Test Playlist 1",
      "items": [
        {
          "contentId": "...",
          "type": "image",
          "url": "...",
          "duration": 10,
          "order": 0
        },
        ...
      ]
    },
    "timestamp": "2026-01-27T14:30:00.000Z"
  }
  ```
- ✅ Playlist items are ordered by `order` field
- ✅ Content URLs are pre-signed MinIO URLs (if applicable)

---

### Test 7.7: Content Impression Logging

**Objective:** Verify device can log content impressions

**Prerequisites:** Connected device from Test 7.1

**Steps:**
1. Emit `content:impression` event:
   ```javascript
   socket.emit('content:impression', {
     contentId: '<imageContentId>',
     playlistId: '<playlist1Id>',
     duration: 10,
     timestamp: new Date().toISOString()
   });
   ```
2. Wait for response

**Expected Results:**
- ✅ Server responds:
  ```json
  {
    "success": true,
    "timestamp": "2026-01-27T14:30:00.000Z"
  }
  ```
- ✅ Database/ClickHouse: Impression logged
- ✅ Prometheus: Impression metric recorded

---

### Test 7.8: Content Error Logging

**Objective:** Verify device can report content playback errors

**Prerequisites:** Connected device from Test 7.1

**Steps:**
1. Emit `content:error` event:
   ```javascript
   socket.emit('content:error', {
     contentId: '<videoContentId>',
     errorType: 'playback_failed',
     errorMessage: 'Video codec not supported',
     timestamp: new Date().toISOString()
   });
   ```
2. Wait for response

**Expected Results:**
- ✅ Server responds:
  ```json
  {
    "success": true
  }
  ```
- ✅ Realtime logs: "Content error on <deviceId>: ..."
- ✅ Database/ClickHouse: Error logged
- ✅ Sentry: Error reported (check Sentry dashboard)
- ✅ Prometheus: Error metric recorded

---

## 8. Real-time Updates

### Test 8.1: Playlist Update Push

**Objective:** Verify device receives real-time playlist updates

**Prerequisites:** 
- Connected device from Test 7.1
- Second WebSocket client listening (or monitor logs)

**Steps:**
1. Keep device WebSocket connected
2. Update playlist via API:
   ```bash
   PATCH /api/playlists/<playlist1Id>
   Body: { "name": "Live Updated Playlist" }
   ```
3. Observe WebSocket events on device

**Expected Results:**
- ✅ Device receives `playlist:update` event:
  ```json
  {
    "playlist": {
      "id": "...",
      "name": "Live Updated Playlist",
      "items": [...]
    },
    "timestamp": "2026-01-27T14:30:00.000Z"
  }
  ```
- ✅ Event received within 1-2 seconds of API update

---

### Test 8.2: Command Push to Device

**Objective:** Verify admin can send commands to specific device

**Steps:**
1. Keep device WebSocket connected
2. Send command via API:
   ```bash
   POST /api/displays/<display1Id>/command
   Body: {
     "action": "reload",
     "params": {}
   }
   ```
3. Observe WebSocket events on device

**Expected Results:**
- ✅ Device receives `command` event:
  ```json
  {
    "action": "reload",
    "params": {},
    "timestamp": "2026-01-27T14:30:00.000Z"
  }
  ```
- ✅ Command delivered instantly

---

### Test 8.3: Organization-Wide Broadcast

**Objective:** Verify broadcasting to all devices in an organization

**Steps:**
1. Connect 2+ devices from same organization (or simulate)
2. Trigger organization broadcast:
   ```bash
   POST /api/organizations/<orgId>/broadcast
   Body: {
     "event": "maintenance:scheduled",
     "data": { "message": "System maintenance at 2am" }
   }
   ```
3. Observe all devices receive the event

**Expected Results:**
- ✅ All devices in org receive `maintenance:scheduled` event
- ✅ Devices from other orgs do NOT receive it

---

### Test 8.4: Dashboard Live Device Status

**Objective:** Verify dashboard receives live device status updates

**Prerequisites:** Dashboard WebSocket connection (if implemented)

**Steps:**
1. Connect device → observe dashboard receives `device:status` with `online`
2. Disconnect device → observe dashboard receives `device:status` with `offline`

**Expected Results:**
- ✅ Dashboard shows real-time status changes
- ✅ Status updates within 1-2 seconds

---

## 9. Content Streaming & Playback

### Test 9.1: Image Content Streaming

**Objective:** Verify device can download and display image content

**Steps:**
1. Request playlist (Test 7.6)
2. Extract image content URL
3. Download image using HTTP client:
   ```bash
   GET <imageUrl>
   ```
4. Verify image file is valid

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Content-Type: `image/jpeg` or `image/png`
- ✅ File size > 0
- ✅ Image opens successfully in viewer

---

### Test 9.2: Video Content Streaming

**Objective:** Verify device can download and play video content

**Steps:**
1. Request playlist (Test 7.6)
2. Extract video content URL
3. Download video using HTTP client:
   ```bash
   GET <videoUrl>
   ```
4. Verify video file is valid

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Content-Type: `video/mp4`
- ✅ File size > 0
- ✅ Video plays successfully in player (VLC, browser, etc.)

---

### Test 9.3: URL Content Rendering

**Objective:** Verify URL content can be loaded

**Steps:**
1. Request playlist (Test 7.6)
2. Extract URL content
3. Open URL in browser:
   ```
   https://google.com
   ```

**Expected Results:**
- ✅ Page loads successfully
- ✅ No CORS errors (if applicable)

---

### Test 9.4: HTML Content Rendering

**Objective:** Verify HTML content renders correctly

**Steps:**
1. Request playlist (Test 7.6)
2. Extract HTML content
3. Render in iframe or webview:
   ```html
   <h1>Hello Vizora!</h1><p>This is custom HTML</p>
   ```

**Expected Results:**
- ✅ HTML renders correctly
- ✅ No XSS vulnerabilities (script tags sanitized if applicable)
- ✅ Styles apply correctly

---

### Test 9.5: Content Sequencing

**Objective:** Verify device plays playlist items in correct order

**Prerequisites:** Playlist with 3+ items

**Steps:**
1. Simulate device playback:
   - Item 0 (image, 10s) → Log impression
   - Item 1 (video, 30s) → Log impression
   - Item 2 (URL, 20s) → Log impression
   - Loop back to Item 0

**Expected Results:**
- ✅ Items play in correct `order` (0, 1, 2, 0, 1, 2, ...)
- ✅ Each impression logged correctly
- ✅ Duration matches configured value

---

### Test 9.6: Schedule-Based Playlist Switching

**Objective:** Verify device switches playlists based on schedule

**Prerequisites:** Multiple schedules (Tests 5.1, 5.2)

**Steps:**
1. Simulate time progression:
   - 09:00 (Monday) → Morning Schedule (priority 1)
   - 11:00 (Monday) → Afternoon Schedule (priority 2) should override
   - 14:00 (Monday) → Back to Morning Schedule (no overlap)

**Expected Results:**
- ✅ Device receives correct playlist for each time slot
- ✅ Higher priority schedule wins during overlap
- ✅ Smooth transitions between schedules

---

## 10. Health & Monitoring

### Test 10.1: Middleware Health Check

**Objective:** Verify basic health endpoint

**Steps:**
1. Send GET request to `/api/health`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response: `{"status": "ok"}`

---

### Test 10.2: Middleware Readiness Check

**Objective:** Verify detailed readiness endpoint

**Steps:**
1. Send GET request to `/api/health/ready`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response:
  ```json
  {
    "status": "ok",
    "info": {
      "database": { "status": "up" },
      "memory_heap": { "status": "up" },
      "memory_rss": { "status": "up" }
    },
    "error": {},
    "details": {
      "database": { "status": "up" },
      "memory_heap": { "status": "up", "... ": "..." },
      "memory_rss": { "status": "up", "... ": "..." }
    }
  }
  ```
- ✅ All services show `status: "up"`

---

### Test 10.3: Realtime Health Check

**Objective:** Verify realtime service health

**Steps:**
1. Send GET request to `http://localhost:3001/health`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response: `{"status": "ok", "timestamp": "..."}`

---

### Test 10.4: Prometheus Metrics

**Objective:** Verify Prometheus metrics endpoint

**Steps:**
1. Send GET request to `http://localhost:3001/metrics`

**Expected Results:**
- ✅ Status: `200 OK`
- ✅ Response in Prometheus format:
  ```
  # HELP vizora_devices_total Total number of devices
  # TYPE vizora_devices_total gauge
  vizora_devices_total{organization="..."} 1
  
  # HELP vizora_heartbeat_duration_seconds Heartbeat processing time
  # TYPE vizora_heartbeat_duration_seconds histogram
  vizora_heartbeat_duration_seconds_bucket{le="0.01"} 5
  ...
  ```
- ✅ Metrics include: devices, connections, heartbeats, impressions, errors

---

### Test 10.5: Sentry Error Reporting

**Objective:** Verify errors are reported to Sentry

**Steps:**
1. Trigger a known error (e.g., Test 7.8 - content error)
2. Check Sentry dashboard

**Expected Results:**
- ✅ Error appears in Sentry within 1-2 minutes
- ✅ Error tagged with: `deviceId`, `errorType`, etc.
- ✅ Stack trace available

---

## 11. Security Testing

### Test 11.1: XSS Protection (Input Sanitization)

**Objective:** Verify HTML is sanitized in inputs

**Steps:**
1. Send POST request to `/api/content`
2. Body:
   ```json
   {
     "type": "html",
     "name": "<script>alert('XSS')</script>Test",
     "htmlContent": "<h1>Safe</h1><script>alert('XSS')</script>",
     "duration": 10
   }
   ```

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Response: `name` has `<script>` tags stripped
- ✅ Response: `htmlContent` has `<script>` tags stripped
- ✅ No JavaScript executed

---

### Test 11.2: SQL Injection Protection

**Objective:** Verify SQL injection is prevented

**Steps:**
1. Send GET request to `/api/content?search=' OR 1=1 --`
2. Try to exploit with common SQL injection patterns

**Expected Results:**
- ✅ No SQL error returned
- ✅ Query returns empty or filtered results
- ✅ No unauthorized data access

---

### Test 11.3: Rate Limiting (General API)

**Objective:** Verify global rate limiting

**Steps:**
1. Send 20 rapid requests to `/api/content` (within 1 second)

**Expected Results:**
- ✅ First 10 requests: `200 OK`
- ✅ 11th+ requests: `429 Too Many Requests`
- ✅ Response: `{"message": "Too many requests"}`

---

### Test 11.4: CORS Configuration

**Objective:** Verify CORS headers are set correctly

**Steps:**
1. Send OPTIONS request to `/api/content`
2. Check headers

**Expected Results:**
- ✅ Status: `204 No Content` or `200 OK`
- ✅ Headers include:
  - `Access-Control-Allow-Origin: *` (or specific domain)
  - `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE`
  - `Access-Control-Allow-Headers: ...`

---

### Test 11.5: JWT Expiration

**Objective:** Verify expired tokens are rejected

**Steps:**
1. Use an expired `accessToken` (or wait for expiry)
2. Send GET request to `/api/users/me`
3. Headers: `Authorization: Bearer <expiredToken>`

**Expected Results:**
- ✅ Status: `401 Unauthorized`
- ✅ Response: `{"message": "Token expired"}`

---

### Test 11.6: Password Security

**Objective:** Verify passwords are hashed, not stored plaintext

**Steps:**
1. Register a new user (Test 1.1)
2. Query database directly:
   ```sql
   SELECT id, email, password FROM users WHERE email = 'test-org1@example.com';
   ```

**Expected Results:**
- ✅ `password` column contains bcrypt hash (starts with `$2a$` or `$2b$`)
- ✅ Password is NOT stored in plaintext

---

### Test 11.7: Device JWT Isolation

**Objective:** Verify device JWT cannot access admin APIs

**Steps:**
1. Use `deviceToken` from Test 6.6
2. Try to call admin API:
   ```bash
   GET /api/content
   Headers: Authorization: Bearer <deviceToken>
   ```

**Expected Results:**
- ✅ Status: `401 Unauthorized` or `403 Forbidden`
- ✅ Device token cannot access admin endpoints

---

## 12. Performance Testing

### Test 12.1: API Response Time (Single Request)

**Objective:** Verify low latency for single API request

**Steps:**
1. Send GET request to `/api/content`
2. Measure response time

**Expected Results:**
- ✅ Response time < 200ms (P95 target: 41ms from load tests)
- ✅ Status: `200 OK`

---

### Test 12.2: Concurrent Device Connections

**Objective:** Verify WebSocket can handle multiple devices

**Prerequisites:** WebSocket load testing script

**Steps:**
1. Connect 10 devices simultaneously
2. Each device sends heartbeats every 15 seconds
3. Monitor for 2 minutes

**Expected Results:**
- ✅ All 10 devices connected successfully
- ✅ All heartbeats acknowledged
- ✅ No disconnections or errors
- ✅ Server memory/CPU stable

---

### Test 12.3: Large Content Upload

**Objective:** Verify system handles large file uploads

**Steps:**
1. Upload a 50MB video file via `/api/content`
2. Monitor upload progress

**Expected Results:**
- ✅ Status: `201 Created`
- ✅ Upload completes within reasonable time (depends on network)
- ✅ File stored correctly in MinIO
- ✅ No memory leaks or crashes

---

### Test 12.4: High-Frequency Heartbeats

**Objective:** Verify system handles rapid heartbeats

**Steps:**
1. Connect device
2. Send heartbeats every 1 second (instead of 15) for 2 minutes

**Expected Results:**
- ✅ All heartbeats acknowledged
- ✅ No rate limiting on heartbeats (or expected rate limit)
- ✅ Server remains stable

---

### Test 12.5: Database Query Performance

**Objective:** Verify database queries are optimized

**Steps:**
1. Create 100 content items, 10 playlists, 5 devices
2. Send GET request to `/api/content`
3. Measure query time

**Expected Results:**
- ✅ Response time < 200ms
- ✅ Database query uses indexes (check with `EXPLAIN ANALYZE`)
- ✅ No N+1 query issues

---

## 13. Error Handling

### Test 13.1: Database Connection Failure

**Objective:** Verify graceful handling of database errors

**Steps:**
1. Stop PostgreSQL database:
   ```bash
   docker stop vizora-postgres
   ```
2. Send GET request to `/api/content`

**Expected Results:**
- ✅ Status: `500 Internal Server Error` or `503 Service Unavailable`
- ✅ Response: `{"message": "Database connection failed"}` (or similar)
- ✅ No sensitive error details exposed
- ✅ Error logged in server logs
- ✅ Sentry captures the error

**Cleanup:**
```bash
docker start vizora-postgres
```

---

### Test 13.2: Invalid Content Type

**Objective:** Verify validation for content types

**Steps:**
1. Send POST request to `/api/content`
2. Body:
   ```json
   {
     "type": "invalid_type",
     "name": "Test",
     "duration": 10
   }
   ```

**Expected Results:**
- ✅ Status: `400 Bad Request`
- ✅ Response: `{"message": "Invalid content type"}`

---

### Test 13.3: Missing Required Fields

**Objective:** Verify validation for required fields

**Steps:**
1. Send POST request to `/api/content`
2. Body:
   ```json
   {
     "type": "image"
     // Missing: name, duration
   }
   ```

**Expected Results:**
- ✅ Status: `400 Bad Request`
- ✅ Response lists missing fields: `{"message": "name is required", ...}`

---

### Test 13.4: File Upload Size Limit

**Objective:** Verify file upload limits are enforced

**Steps:**
1. Try to upload a 2GB file (if limit is 100MB)
2. Send POST request to `/api/content`

**Expected Results:**
- ✅ Status: `413 Payload Too Large`
- ✅ Response: `{"message": "File size exceeds limit"}`

---

### Test 13.5: Invalid Device Token

**Objective:** Verify WebSocket handles malformed tokens

**Steps:**
1. Try to connect with corrupted token:
   ```javascript
   const socket = io('http://localhost:3001', {
     auth: {
       token: 'totally-not-a-jwt'
     }
   });
   ```

**Expected Results:**
- ✅ Connection immediately disconnected
- ✅ Server logs error (not crash)
- ✅ No sensitive info leaked

---

## 14. Multi-Tenant Isolation

### Test 14.1: Organization Content Isolation

**Objective:** Verify Org 1 cannot see Org 2's content

**Prerequisites:** 
- User 1 (Org 1) logged in
- User 2 (Org 2) logged in

**Steps:**
1. Org 1: Upload content → Save content ID
2. Org 2: Try to GET `/api/content/<org1ContentId>` with Org 2 token

**Expected Results:**
- ✅ Status: `404 Not Found` or `403 Forbidden`
- ✅ No content data leaked

---

### Test 14.2: Organization Playlist Isolation

**Objective:** Verify Org 1 cannot see Org 2's playlists

**Steps:**
1. Org 1: Create playlist → Save playlist ID
2. Org 2: Try to GET `/api/playlists/<org1PlaylistId>` with Org 2 token

**Expected Results:**
- ✅ Status: `404 Not Found` or `403 Forbidden`
- ✅ No playlist data leaked

---

### Test 14.3: Organization Device Isolation

**Objective:** Verify Org 1 cannot see Org 2's devices

**Steps:**
1. Org 1: Create display → Save display ID
2. Org 2: Try to GET `/api/displays/<org1DisplayId>` with Org 2 token

**Expected Results:**
- ✅ Status: `404 Not Found` or `403 Forbidden`
- ✅ No device data leaked

---

### Test 14.4: WebSocket Room Isolation

**Objective:** Verify Org 1 devices don't receive Org 2 broadcasts

**Steps:**
1. Connect device from Org 1
2. Connect device from Org 2
3. Broadcast message to Org 2:
   ```bash
   POST /api/organizations/<org2Id>/broadcast
   Body: { "event": "test", "data": { "secret": "org2-only" } }
   ```
4. Verify Org 1 device does NOT receive the event

**Expected Results:**
- ✅ Org 2 device receives event
- ✅ Org 1 device does NOT receive event
- ✅ No cross-organization leakage

---

### Test 14.5: Storage Isolation (MinIO)

**Objective:** Verify content files are isolated by organization

**Steps:**
1. Org 1: Upload image
2. Org 2: Upload image
3. Check MinIO bucket structure

**Expected Results:**
- ✅ Files stored with org-specific prefixes: `org/<orgId>/content/...`
- ✅ Org 1 cannot access Org 2's file URLs (or pre-signed URLs expire)

---

## Test Results Template

Use this template to document your testing:

```markdown
# Vizora Manual Testing Results

**Date:** YYYY-MM-DD  
**Tester:** [Your Name]  
**Environment:** Local / Staging / Production  
**Build Version:** [git commit hash]

---

## Summary

| Category | Total Tests | Passed | Failed | Skipped |
|----------|-------------|--------|--------|---------|
| Authentication | 7 | 7 | 0 | 0 |
| Organization | 3 | 3 | 0 | 0 |
| Content | 9 | 9 | 0 | 0 |
| Playlists | 6 | 6 | 0 | 0 |
| Schedules | 5 | 5 | 0 | 0 |
| Displays | 7 | 7 | 0 | 0 |
| WebSocket | 8 | 8 | 0 | 0 |
| Real-time | 4 | 4 | 0 | 0 |
| Streaming | 6 | 6 | 0 | 0 |
| Health | 5 | 5 | 0 | 0 |
| Security | 7 | 7 | 0 | 0 |
| Performance | 5 | 5 | 0 | 0 |
| Error Handling | 5 | 5 | 0 | 0 |
| Multi-Tenant | 5 | 5 | 0 | 0 |
| **TOTAL** | **82** | **82** | **0** | **0** |

**Overall Pass Rate:** 100%

---

## Detailed Results

### 1. Authentication & User Management

#### Test 1.1: User Registration
- **Status:** ✅ PASS
- **Time:** 2026-01-27 14:05:23
- **Notes:** User registered successfully, tokens valid

#### Test 1.2: User Login
- **Status:** ✅ PASS
- **Time:** 2026-01-27 14:06:45
- **Notes:** Login successful

... (continue for all tests)

---

## Issues Found

### Issue #1: [Issue Title]
- **Severity:** Critical / High / Medium / Low
- **Test:** Test X.Y
- **Description:** [What went wrong]
- **Steps to Reproduce:** 
  1. Step 1
  2. Step 2
- **Expected:** [What should happen]
- **Actual:** [What actually happened]
- **Workaround:** [If any]

---

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]

---

## Sign-off

**Tested by:** [Name]  
**Date:** YYYY-MM-DD  
**Approved by:** [Project Manager / Tech Lead]  
**Status:** ✅ Ready for Production / ⚠️ Issues Found / ❌ Not Ready
```

---

## Notes for Clawdbot

If you (Clawdbot) are executing these tests:

1. **Session Tracking:** Create a `test-session.json` file to track test data
2. **Automation:** Use `curl` or Node.js scripts for HTTP requests
3. **WebSocket Testing:** Use Socket.IO client library in Node.js
4. **Logging:** Capture all request/response details
5. **Failure Handling:** On test failure, log details and continue with remaining tests
6. **Report Generation:** Auto-generate test results using the template above

### Sample Automation Script

```javascript
const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000/api';
const testResults = [];

async function runTest(testName, testFn) {
  const start = Date.now();
  try {
    await testFn();
    testResults.push({
      test: testName,
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString()
    });
    console.log(`✅ ${testName} - PASS`);
  } catch (error) {
    testResults.push({
      test: testName,
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - start,
      timestamp: new Date().toISOString()
    });
    console.error(`❌ ${testName} - FAIL:`, error.message);
  }
}

async function main() {
  // Test 1.1: User Registration
  await runTest('1.1 User Registration', async () => {
    const res = await axios.post(`${BASE_URL}/auth/register`, {
      email: 'test-org1@example.com',
      password: 'Test123!@#',
      organizationName: 'Test Organization 1'
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.accessToken) throw new Error('No accessToken in response');
    // Save token for later tests
    global.accessToken = res.data.accessToken;
  });

  // Test 1.2: User Login
  await runTest('1.2 User Login', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test-org1@example.com',
      password: 'Test123!@#'
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // ... more tests

  // Generate report
  console.log('\n--- Test Results ---');
  console.log(`Total: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter(t => t.status === 'PASS').length}`);
  console.log(`Failed: ${testResults.filter(t => t.status === 'FAIL').length}`);
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('test-results.json', JSON.stringify(testResults, null, 2));
}

main().catch(console.error);
```

---

## Appendix: Common Issues & Troubleshooting

### Issue: "Connection refused" on API calls
- **Solution:** Verify middleware is running on port 3000
- **Check:** `curl http://localhost:3000/api/health`

### Issue: Database connection errors
- **Solution:** Verify PostgreSQL is running
- **Check:** `docker ps | grep postgres`

### Issue: WebSocket connection fails
- **Solution:** Verify realtime service is running on port 3001
- **Check:** `curl http://localhost:3001/health`

### Issue: MinIO file upload fails
- **Solution:** Verify MinIO is running and accessible
- **Check:** MinIO console at `http://localhost:9001`

### Issue: JWT token invalid
- **Solution:** Check JWT_SECRET and DEVICE_JWT_SECRET in .env
- **Verify:** Decode token at jwt.io and check signature

---

**End of Manual Testing Guide**
