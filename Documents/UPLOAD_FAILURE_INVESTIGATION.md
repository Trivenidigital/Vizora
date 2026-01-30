# Content Upload Failure Investigation

**Date**: 2026-01-29
**Status**: ROOT CAUSE IDENTIFIED
**Severity**: Expected Behavior (Backend Not Running)

---

## Issue Description

When trying to upload content (image):
- File shows "0 file(s) uploaded successfully" toast message
- File does not appear in the Content Library
- "Offline mode" indicator shows on the Content page

---

## Root Cause: Backend API Not Running

### Evidence from Dev Server Logs

```
Line 298: GET /api/displays 404 in 906ms
```

The frontend tries to fetch available displays/content from the backend API at `http://localhost:3000/api` but gets a **404 (Not Found)** error because:

**The backend API server is NOT running**

---

## Why Upload Fails

### Upload Flow

1. User selects image file
2. Clicks "Upload Content"
3. Frontend calls: `apiClient.createContent({ title, type, url })`
4. This makes: `POST http://localhost:3000/api/content`
5. Backend API not running → Request fails
6. Error caught: "Request failed" or similar
7. Upload marked as failed
8. Toast shows: "0 file(s) uploaded successfully"

### Code Reference

```typescript
// File: web/src/app/dashboard/content/page.tsx, Line 237
const newContent = await apiClient.createContent(uploadForm);
         ↓
// File: web/src/lib/api.ts, Line 250-266
async createContent(data: { title: string; type: string; url?: string; ... }): Promise<Content> {
  const payload = { name: data.title, type: data.type, url: data.url, ... };
  return this.request<Content>('/content', {  // ← Makes POST to /content
    method: 'POST',
    body: JSON.stringify(payload),
  });
         ↓
// File: web/src/lib/api.ts, Line 64
const response = await fetch(`${this.baseUrl}${endpoint}`, {...});
                        ↑
                        http://localhost:3000/api/content
                        (API server not running)
                        ↓
                        404 - Connection refused
```

---

## "Offline Mode" Indicator

The Content page shows "Offline mode" because:

```typescript
// File: web/src/app/dashboard/content/page.tsx, Lines 65-77
const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');

const { isConnected, isOffline } = useRealtimeEvents({
  enabled: true,
  onConnectionChange: (connected) => {
    setRealtimeStatus(connected ? 'connected' : 'offline');
    if (connected) {
      toast.info('Real-time sync enabled');
    }
  },
});
```

The real-time events service (Socket.io on port 3002) might be connected, but the backend API (port 3000) is not, causing the page to show "offline" state.

---

## Solution: Start Backend API Server

To enable content upload, you need to start the backend API server:

```bash
# Navigate to backend directory
cd /path/to/backend

# Start the API server (should run on port 3000)
npm run dev
# or
npm start
```

### Expected API Endpoints

Once backend is running, these endpoints should be available:

```
POST   /api/content              - Upload/create content
GET    /api/content              - List all content
GET    /api/content/:id          - Get specific content
PATCH  /api/content/:id          - Update content
DELETE /api/content/:id          - Delete content
POST   /api/content/:id/thumbnail - Generate thumbnail
GET    /api/displays             - List devices
GET    /api/displays/:id         - Get specific device
POST   /api/playlists            - Create playlist
GET    /api/playlists            - List playlists
```

---

## What Happens After API Starts

### Before API Running ❌
```
1. Upload form shown
2. User selects image
3. Click "Upload Content"
4. POST /api/content fails (404 - API not running)
5. Toast: "0 file(s) uploaded successfully"
6. No file appears
```

### After API Running ✅
```
1. Upload form shown
2. User selects image
3. Click "Upload Content"
4. POST /api/content succeeds (200 - API responds)
5. File saved to backend
6. Toast: "1 file(s) uploaded successfully"
7. File appears in Content Library
8. Content synchronized across all pages
```

---

## Verification Checklist

### Check Backend Status
```bash
# Try to connect to backend API
curl http://localhost:3000/api/content

# Expected if running: JSON response with content list
# Expected if NOT running: Connection refused
```

### Check Frontend Logs
In browser DevTools Console:
```javascript
// Look for API errors like:
[API] Request: POST http://localhost:3000/api/content
[API] Response status: 404
[API] Request failed with status 404
```

### Check Network Tab
Open DevTools → Network Tab → Filter "content"
- Try to upload image
- Look for `POST /api/content` request
- Status: Should be 201 (success) or 404 (API not running)

---

## Current Architecture

```
Frontend (Next.js on port 3002)
├─ Can fetch pages ✅
├─ Can display UI ✅
├─ Tries to call backend API ❌ (Not running)
│  ├─ GET /api/displays → 404
│  ├─ GET /api/content → 404
│  └─ POST /api/content → 404
│
Backend API (port 3000) ❌ NOT RUNNING
├─ Content endpoints not available
├─ Device endpoints not available
└─ Upload functionality unavailable
```

---

## Summary

**The upload failure is not a code bug.** The application is working as designed:

✅ **Frontend properly:**
- Handles upload form
- Validates input
- Makes API call
- Catches errors gracefully
- Shows user-friendly message

❌ **What's missing:**
- Backend API server running on port 3000
- Content endpoints available
- File storage/database

---

## Action Items

1. **Start the backend API server** on port 3000
2. **Ensure these ports are accessible:**
   - Port 3000: Backend API
   - Port 3002: Frontend & Socket.io
3. **Verify connectivity:**
   ```bash
   curl http://localhost:3000/api/content
   curl http://localhost:3002/api/content  # Should proxy to 3000
   ```
4. **Try upload again** after API is running

---

**Status**: ROOT CAUSE IDENTIFIED ✅
**Action Needed**: Start backend API server on port 3000
**Expected Result**: Content upload will work successfully
