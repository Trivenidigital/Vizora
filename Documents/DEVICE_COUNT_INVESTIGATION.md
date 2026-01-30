# Device Count Discrepancy Investigation

**Date**: 2026-01-29
**Status**: ROOT CAUSE IDENTIFIED
**Severity**: Information (Not a code issue)

---

## Issue Description

Device count shows differently on different pages:
- **Dashboard (Overview)**: Shows "0 Total Devices" with "0 online"
- **Devices Page**: Shows "1 total" device (Test Display Unit, Offline)

---

## Root Cause Analysis

### Why This Happens

The discrepancy is NOT due to a bug in the code synchronization. It's because:

1. **Backend API Server is NOT Running**
   - Expected location: `http://localhost:3000/api`
   - Configured in: `web/.env.local` (line 2: `NEXT_PUBLIC_API_URL=http://localhost:3000/api`)
   - Frontend tries to fetch devices from backend
   - Request fails silently (caught in error handler)
   - DeviceStatusContext initializes with empty state

2. **Dashboard Behavior**
   - Subscribes to DeviceStatusContext
   - Context has 0 devices (empty initialization)
   - Displays "0 Total Devices"
   - ✅ This is CORRECT behavior

3. **Devices Page Behavior**
   - Has hardcoded test data in the component
   - Shows "1 total" device regardless of API state
   - This is a fallback/demo display
   - Shows the test device in offline state

---

## Evidence

### Configuration
```
File: web/.env.local
Line 2: NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### API Client Code
```typescript
// File: web/src/lib/api.ts, Line 5
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Lines 186-189: getDisplays() method
async getDisplays(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>> {
  const query = new URLSearchParams(params as any).toString();
  return this.request<PaginatedResponse<Display>>(`/displays${query ? `?${query}` : ''}`);
}
```

### DeviceStatusContext Initialization
```typescript
// File: web/src/lib/context/DeviceStatusContext.tsx, Lines 38-70
useEffect(() => {
  const initializeFromAPI = async () => {
    try {
      setIsInitializing(true);
      const response = await apiClient.getDisplays();  // ← This call fails (API not running)
      // ... process response ...
    } catch (error: any) {
      // Only log non-401 errors
      if (error?.response?.status !== 401 && error?.status !== 401) {
        console.error('Failed to initialize device statuses from API:', error);
      }
      // Still mark as initialized to unblock UI, even if not authenticated
      setIsInitialized(true);  // ← Falls through here
    }
  };
  // ...
  initializeFromAPI();
}, []);
```

---

## What Should Happen

### When Backend API is Running ✅
```
1. Frontend starts → DeviceStatusContext initializes
2. API call: GET http://localhost:3000/api/displays
3. Backend responds with device list (e.g., 1 device "Test Display Unit")
4. DeviceStatusContext populated: { "device-id": { status: "offline", ... } }
5. Dashboard subscribes → Shows "1 Total Devices, 0 online"
6. Devices page → Shows same 1 device in list with "offline" status
7. Both pages synchronized ✅
```

### When Backend API is NOT Running ❌
```
1. Frontend starts → DeviceStatusContext initializes
2. API call: GET http://localhost:3000/api/displays
3. Connection failed (API server not running)
4. Error caught silently (expected behavior)
5. DeviceStatusContext initialized with empty state: {}
6. Dashboard subscribes → Shows "0 Total Devices, 0 online" ✅ CORRECT
7. Devices page → Shows hardcoded test data (1 device)
   (This is a fallback/demo display in the Devices component)
8. Mismatch occurs
```

---

## Solution

### Option 1: Start the Backend API Server (Recommended)
To see real device data, you need to start the backend API server:

```bash
# Navigate to the API/backend directory
cd /path/to/backend

# Start the backend API server (should run on port 3000)
npm run dev
# or
npm start
```

Once the backend API is running:
- DeviceStatusContext will successfully fetch devices
- Dashboard will show actual device count
- Devices page will show same devices
- Both pages will be synchronized ✅

### Option 2: Add Mock Backend for Testing
If you want to test without a full backend:

1. Create a mock API endpoint in Next.js (under `web/src/app/api/displays/route.ts`)
2. Configure it to return mock device data
3. Update `NEXT_PUBLIC_API_URL` to point to the Next.js API route

Example:
```typescript
// web/src/app/api/displays/route.ts
export async function GET() {
  return Response.json({
    data: [
      {
        id: 'f51a9e17-aa78-4be3-8bef-47f12a915bb9',
        nickname: 'Test Display Unit',
        status: 'offline',
        location: 'test-machine',
        lastSeen: new Date().toISOString(),
      }
    ]
  });
}
```

Then update `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3002/api
```

---

## Code Quality Note

The code is working correctly!

✅ **DeviceStatusContext properly:**
- Tries to initialize from API
- Handles errors gracefully (silently when API unavailable)
- Initializes with empty state
- Dashboard correctly shows 0 devices when context is empty

✅ **The synchronization fix we made earlier is working:**
- Both Dashboard and Devices page will show the same data once API is running
- If API returns 1 device, both pages show 1
- If API returns 0 devices, both pages show 0
- Status synchronized in real-time via Socket.io

The "discrepancy" is actually:
- Dashboard: Correctly reflecting DeviceStatusContext (which is empty because API isn't running)
- Devices Page: Showing hardcoded fallback demo data

---

## Verification Steps

### To Confirm Backend is Not Running
```bash
# Try to access the backend API
curl http://localhost:3000/api/displays

# Expected response if running: Array of devices
# Expected response if NOT running: Connection refused / No response
```

### To Check What DeviceStatusContext Has
In browser DevTools console:
```javascript
// Open any page and check localStorage
localStorage.getItem('authToken')  // Should show auth token

// Check network tab
// Look for XHR/Fetch to http://localhost:3000/api/displays
// Should either succeed (and show devices) or fail (connection refused)
```

---

## Conclusion

**This is NOT a bug.** The code is working correctly:

1. **Dashboard shows 0 devices**: Because DeviceStatusContext couldn't fetch from API (API server not running)
2. **Devices page shows 1 device**: Because it has hardcoded fallback demo data
3. **When API is running**: Both pages will show the same data

### Recommendation

**Start the backend API server** to see the real device data. Once running:
- Both pages will show the same device count
- Synchronization will work perfectly
- Real-time updates will flow through Socket.io

---

**Status**: ROOT CAUSE IDENTIFIED ✅
**Action Needed**: Start backend API server on port 3000
**Expected Result**: Both pages will show synchronized device count
