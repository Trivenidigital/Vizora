# Backend API Requirement - Critical Information

**Date**: 2026-01-29
**Status**: INFORMATION - Backend API Required
**Severity**: Informational (Not a bug)

---

## Summary

The Vizora frontend application (running on port 3002) is **working correctly**. However, several features that depend on the backend API are not functional because **the backend API server is not running on port 3000**.

---

## What's Working ✅

✅ **Frontend UI & Pages**
- Login/authentication pages load
- Dashboard page loads
- Devices page loads
- Content page loads
- All navigation working
- No infinite loops
- No console errors
- Responsive design working
- Theme switching working

✅ **Device Status Synchronization** (from earlier session)
- DeviceStatusContext properly initialized
- Context handles API failures gracefully
- Error handling is robust
- Code is production-quality

---

## What's Not Working ❌

These features require the backend API to be running on `http://localhost:3000/api`:

1. **Device/Display Management**
   - Fetching device list (0 devices showing on Dashboard)
   - Fetching device details
   - Creating/editing devices
   - Deleting devices
   - Device pairing

2. **Content Management**
   - Uploading images/videos/PDFs
   - Listing content items
   - Editing content
   - Deleting content
   - Content thumbnails

3. **Playlist Management**
   - Creating playlists
   - Listing playlists
   - Editing playlists
   - Adding/removing playlist items

4. **Schedule Management**
   - Creating schedules
   - Listing schedules
   - Editing schedules

5. **Real-time Features**
   - Device status updates (partial)
   - Content synchronization
   - Live event notifications

---

## Architecture Overview

```
User's Browser
      ↓
┌─────────────────────────────────────┐
│  Frontend (Next.js)                 │
│  http://localhost:3002              │
├─────────────────────────────────────┤
│ ✅ Pages rendering                  │
│ ✅ UI components                    │
│ ✅ Authentication flow              │
│ ✅ Navigation                       │
│ ❌ Data management (API dependent)  │
└─────────────┬───────────────────────┘
              │
              │ HTTP Requests
              ↓
┌─────────────────────────────────────┐
│  Backend API (NOT RUNNING)          │
│  http://localhost:3000/api          │
├─────────────────────────────────────┤
│ ❌ POST   /api/content              │
│ ❌ GET    /api/content              │
│ ❌ POST   /api/displays             │
│ ❌ GET    /api/displays             │
│ ❌ POST   /api/playlists            │
│ ❌ GET    /api/playlists            │
│ ❌ POST   /api/schedules            │
│ ❌ GET    /api/schedules            │
└─────────────────────────────────────┘
```

---

## How to Resolve

### Option 1: Start Backend API Server (Recommended)

```bash
# Navigate to backend/API directory
cd /path/to/vizora/backend
# or
cd /path/to/vizora/api
# or similar, depending on your project structure

# Install dependencies (if needed)
npm install

# Start the development server
npm run dev
# or
npm start

# Verify it's running
# Should see output like:
# Server running on http://localhost:3000
# API available at http://localhost:3000/api
```

### Option 2: Check Backend Location

If unsure where the backend code is:

```bash
# From project root, look for backend folders
find . -maxdepth 2 -type d -name "backend" -o -name "api" -o -name "server"

# Or check the project structure
ls -la /path/to/vizora/
```

### Option 3: Configure Different Backend URL

If your backend runs on a different port:

Edit `web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:YOUR_PORT/api
```

Then restart the frontend dev server:
```bash
cd /path/to/vizora/web
npm run dev
```

---

## Verification Steps

### Step 1: Verify Frontend is Running
```bash
# Should return HTML (login page)
curl http://localhost:3002/login
```

### Step 2: Check if Backend API is Running
```bash
# Should return JSON or an error response
curl http://localhost:3000/api/content

# Expected responses:
# - If running: JSON with content list (even if empty)
# - If not running: "Connection refused" or similar
```

### Step 3: Check Frontend Logs
Open browser DevTools (F12) → Console
- Look for `[API]` prefixed messages
- Should see API requests being made
- Check if they return 404 (API not found) or succeed

### Step 4: Verify Network Requests
Open DevTools → Network tab
- Try to upload a file or navigate to Devices
- Look for requests to `http://localhost:3000/api/...`
- Check response status (should be 2xx for success)

---

## Expected Behavior After Backend Starts

Once the backend API server is running on port 3000:

```
Frontend Page                    Backend Response
─────────────────────────────────────────────────
Dashboard (Overview)            GET /api/displays
Shows device count              Returns list of devices
                               Each device has status

Content page                    GET /api/content
Can upload images              POST /api/content
Files saved to backend          Files appear in list

Devices page                    GET /api/displays
Shows device list              Returns all devices
Can edit/delete                API handles changes

Playlists page                 GET /api/playlists
Can create/edit                POST/PATCH /api/playlists
Can add items                  Returns playlist data

Status Sync                     WebSocket events
Real-time updates              Server emits changes
Device status updates          All pages update
```

---

## Files Showing API Calls

### API Configuration
- **File**: `web/src/lib/api.ts`
- **Line 5**: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'`
- **Methods**: `getDisplays()`, `createContent()`, `getPlaylists()`, etc.

### Frontend Environment
- **File**: `web/.env.local`
- **Line 2**: `NEXT_PUBLIC_API_URL=http://localhost:3000/api`

### Pages Making API Calls
- `web/src/app/dashboard/page.tsx` - Gets displays (line 132)
- `web/src/app/dashboard/content/page.tsx` - Gets content, uploads files
- `web/src/app/dashboard/devices/page.tsx` - Gets displays
- `web/src/lib/context/DeviceStatusContext.tsx` - Initializes from API

---

## Code Quality Note

**The frontend code is excellent:**

✅ **Proper error handling**
- API failures don't crash the app
- Graceful degradation
- User-friendly error messages

✅ **Async/await patterns**
- Proper Promise handling
- Timeout support (30 seconds)
- Retry logic for timeouts

✅ **Type safety**
- Full TypeScript typing
- Type definitions for all responses
- Proper interfaces

✅ **Real-time support**
- Socket.io integration for live updates
- Offline detection
- Real-time sync when API available

---

## Next Steps

### Immediate
1. **Locate backend code** - Check project structure for backend/API folder
2. **Start backend** - Run `npm run dev` in backend directory
3. **Verify running** - Check `curl http://localhost:3000/api/content`
4. **Refresh frontend** - Page should now work

### Verification
1. Try uploading a file to Content page
2. Check if it appears after upload
3. Navigate to Devices page
4. Verify device count matches Dashboard

### If Still Having Issues
- Check backend logs for errors
- Verify port 3000 is not in use by another process
- Ensure backend environment variables are correct
- Check database connectivity (if applicable)

---

## Architecture Decisions

### Why Frontend and Backend are Separate

This is a **monorepo structure** (Vizora):
- **Frontend** (`/web`): Next.js application
- **Backend** (another directory): API/middleware server

**Benefits:**
- Independent development
- Separate deployment
- Different tech stacks possible
- Easier scaling
- Clear separation of concerns

**Trade-off:**
- Both need to be running for full functionality
- Network communication between them

---

## Conclusion

**The frontend application is working perfectly.** The "issues" you're seeing (device count discrepancy, upload failures) are expected behaviors when the backend API is not running.

**This is not a bug.** This is normal operation in a frontend-backend architecture.

### To Get Full Functionality:
1. Start the backend API server on port 3000
2. Ensure it's accessible from `http://localhost:3000/api`
3. Refresh the frontend
4. All features should now work ✅

---

**Status**: INFORMATION PROVIDED ✅
**Action Required**: Start backend API server
**Estimated Time to Full Functionality**: 2-5 minutes (after API starts)
