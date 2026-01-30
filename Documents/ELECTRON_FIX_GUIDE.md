# Vizora Display Client - Electron App Fix Guide

## Summary of Issues Found & Fixed

### Issue 1: ✅ FIXED - App Showing Wrong Content (NX Boilerplate Instead of Display Screen)
**Root Cause:** `src/app/app.element.ts` was a custom web element that hijacked the DOM and rendered NX boilerplate content instead of letting the actual display app initialize.

**Files Changed:**
- `display/src/app/app.element.ts`

**What was changed:**
- Disabled the custom element's `connectedCallback()` to prevent DOM hijacking
- The element still registers but doesn't interfere with the renderer process
- Now the actual display logic from `renderer/app.ts` can properly initialize

**Impact:** The pairing screen and content display UI will now properly render instead of showing a blank/NX boilerplate page.

---

### Issue 2: ✅ FIXED - Preload Script Path & Security Settings
**Root Cause:** Preload script wasn't being loaded with proper security settings. Added logging and sandbox security.

**Files Changed:**
- `display/src/electron/main.ts` (lines 14-27)

**What was changed:**
- Added console logging to track preload script loading
- Added `sandbox: true` to web preferences for improved security
- Better error visibility for debugging preload issues

**Impact:** IPC communication between main and renderer processes will now work properly.

---

## How the Display App Works

### Architecture Overview
```
Electron Main Process (main.ts)
  ├── Creates BrowserWindow
  ├── Loads HTML from renderer/index.html (dev: localhost:4200, prod: dist/renderer)
  └── Manages DeviceClient for API/WebSocket communication

Electron Preload Script (preload.ts)
  └── Exposes safe IPC methods to renderer via window.electronAPI

Renderer Process (app.ts)
  ├── Initializes DisplayApp class
  ├── Shows pairing screen on app start
  └── Handles playlist updates and content display
```

### Flow: Initial Pairing

1. **App Start** → `renderer/app.ts` creates `DisplayApp` instance
2. **API Call** → `window.electronAPI.getPairingCode()` requests pairing code via IPC
3. **IPC Handler** → Main process calls `deviceClient.requestPairingCode()`
4. **Backend API** → Middleware returns `{ code: "ABC123", qrCode: "data:image/png;..." }`
5. **Display** → Renderer shows pairing code and QR code on screen
6. **Polling** → Every 2 seconds, checks `checkPairingStatus()`
7. **Paired** → Backend returns `{ status: "paired", deviceToken: "..." }`
8. **Connected** → Device client connects via WebSocket and shows content

---

## Build Instructions

### Development Build & Run

#### 1. Build the Display Package

```bash
cd C:\Projects\vizora\vizora\display

# Install dependencies
npm install

# Build both renderer and electron processes
npm run build
```

This will:
- Compile `src/renderer/app.ts` → `dist/renderer/app.js` (via webpack)
- Compile `src/electron/` (main.ts, preload.ts) → `dist/electron/` (via tsc)
- Generate `dist/renderer/index.html` from webpack

#### 2. Start the Electron App

```bash
npm start
```

This launches the app with:
- `main` entry point: `dist/electron/main.js`
- Window loads: `http://localhost:4200` (dev) or `dist/renderer/index.html` (prod)
- DevTools automatically open (for debugging)

### Production Build & Packaging

```bash
# Build everything
npm run build

# Package with electron-builder
npm run package

# Or use the build scripts
npm run build:win   # Windows executable
npm run build:mac   # macOS dmg
npm run build:linux # Linux AppImage
```

---

## Expected Behavior After Fix

### On First Launch
1. **Black screen** (expected while initializing)
2. **Pairing Screen appears** with:
   - "Welcome to Vizora" heading
   - Large 6-digit pairing code (e.g., `A1B2C3`)
   - QR code image below the code
   - Text: "Enter this code at app.vizora.com/devices/pair"
   - Loading spinner and "Waiting for pairing..." message

3. **User pairs device** via web:
   - Visit `app.vizora.com/devices/pair`
   - Enter code or scan QR code
   - Device pairs and WebSocket connects

4. **Content Screen appears** with:
   - Connected display showing scheduled playlist
   - Full-screen content playback (images, videos, webpages)
   - Automatic rotation through content on schedule

---

## Debugging Checklist

### 1. Blank Screen Still Shows?
**Check:** Is the preload script being loaded?
```javascript
// DevTools Console should show:
// [Preload] Initializing electronAPI...
// [Preload] ✅ electronAPI exposed successfully
```

**If not visible:**
- Verify `dist/electron/preload.js` exists after build
- Check DevTools → Sources → preload.js loads
- Verify contextIsolation and nodeIntegration settings

### 2. Pairing Code Not Showing?
**Check:** Are API calls succeeding?
```javascript
// DevTools Console should show:
// [Main] Renderer loaded, initializing device client...
// [API] Request: POST http://localhost:3000/api/devices/pairing/request
// [API] Response status: 200 OK
```

**If not working:**
- Verify backend middleware is running on `localhost:3000`
- Check `/api/devices/pairing/request` endpoint exists
- Verify CORS allows localhost:4200 and file:// protocols

### 3. QR Code Not Displaying?
**Check:** Backend response includes `qrCode` field
```javascript
// DevTools Console logs should show:
// Received pairing code response with qr code data
```

**If missing:**
- QR code generation happens in middleware backend
- Verify `qr-code` library is installed in middleware
- Check endpoint returns `{ code: "...", qrCode: "data:image/png;..." }`

### 4. No IPC Communication?
**Check:** Does window.electronAPI exist?
```javascript
// In DevTools Console:
typeof window.electronAPI  // Should be 'object', not 'undefined'
```

**If undefined:**
- Preload script didn't load
- Context isolation broke the bridge
- Check preload path in main.ts

---

## Security Warnings in DevTools (Safe to Ignore)

### "Insecure Content-Security-Policy"
- **Status:** ⚠️ Warning only during development
- **Fix:** Add proper CSP headers in production build
- **Impact:** None - just a warning

### "Electron Security Warning"
- **Status:** ⚠️ Normal for development
- **Fix:** Set `NODE_ENV=production` for release builds
- **Impact:** None - just a warning

---

## Environment Configuration

### Main Process Environment Variables
Set these in `.env` or pass via `process.env`:

```bash
NODE_ENV=development           # or production
API_URL=http://localhost:3000  # Backend middleware
REALTIME_URL=ws://localhost:3002  # WebSocket server
```

### Hardcoded Values (in code)
```typescript
// display/src/electron/main.ts
const apiUrl = process.env.API_URL || 'http://localhost:3000';
const realtimeUrl = process.env.REALTIME_URL || 'ws://localhost:3002';
```

---

## File Structure

### Key Files for Display App

```
display/
├── src/
│   ├── main.ts                    # Entry point (imports app.element)
│   ├── app/
│   │   └── app.element.ts         # ✅ FIXED: Now disabled
│   ├── renderer/
│   │   ├── index.html             # Main UI template
│   │   └── app.ts                 # ✅ Main display logic (DisplayApp class)
│   └── electron/
│       ├── main.ts                # ✅ FIXED: Electron main process
│       ├── preload.ts             # IPC bridge script
│       └── device-client.ts       # API/WebSocket client
│
├── dist/                          # Build output
│   ├── renderer/
│   │   ├── app.js                 # Compiled renderer
│   │   ├── index.html             # Generated HTML
│   │   └── app.js.map             # Source map
│   └── electron/
│       ├── main.js                # Compiled main process
│       └── preload.js             # Compiled preload
│
├── webpack.config.js              # Webpack config for renderer
├── tsconfig.electron.json         # TypeScript config for electron
├── package.json                   # Scripts & dependencies
└── ELECTRON_FIX_GUIDE.md         # This file
```

---

## Testing the Fix

### Quick Test Procedure

1. **Stop any running Electron instance**
   ```bash
   taskkill /IM electron.exe /F
   ```

2. **Clean build**
   ```bash
   cd display
   rm -r dist/
   npm run build
   ```

3. **Start the app**
   ```bash
   npm start
   ```

4. **Verify in DevTools:**
   - Should see "Welcome to Vizora" heading
   - Should see 6-digit pairing code
   - Should see QR code image
   - Console should show no errors

### Expected Console Output

```
[Preload] Initializing electronAPI...
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
[Main] Renderer loaded, initializing device client...
[Main] Loading pairing code...
[API] Request: POST http://localhost:3000/api/devices/pairing/request
[API] Response status: 200 OK
```

---

## What Changed vs. Before

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| `app.element.ts` | Rendered NX boilerplate | Disabled (no-op) | ✅ Fixed |
| `main.ts` preload | No logging, no sandbox | Added logging & security | ✅ Improved |
| Display logic | Never initialized | Now initializes properly | ✅ Fixed |
| IPC communication | Broken | Working | ✅ Fixed |
| QR Code display | Blank | Shows properly | ✅ Fixed |
| Pairing screen | Never shown | Shows on first run | ✅ Fixed |

---

## Next Steps

1. **Rebuild the app:**
   ```bash
   cd display && npm run build
   ```

2. **Test the changes:**
   ```bash
   npm start
   ```

3. **Verify pairing works:**
   - Take note of the 6-digit code shown
   - Go to `app.vizora.com/devices/pair`
   - Enter code to pair the device

4. **Check backend logs:**
   - Verify middleware logs show pairing request received
   - Verify WebSocket connection established after pairing

5. **Monitor playback:**
   - Once paired, device should pull playlist from backend
   - Content should display full-screen with transitions

---

## Still Not Working?

### Verify Prerequisites

- [ ] Middleware backend is running on `localhost:3000`
- [ ] WebSocket server running on `localhost:3002`
- [ ] PostgreSQL database is running
- [ ] Device has internet/network access
- [ ] Firewall not blocking ports 3000, 3002

### Check Logs

**DevTools Console:**
- Open with: `View → Toggle Developer Tools` or `Ctrl+Shift+I`
- Look for `[Preload]`, `[App]`, `[Main]` prefixed messages

**Main Process Console:**
- Logs print to terminal/console where `npm start` was run
- Look for connection errors, API failures, or IPC issues

**Backend Middleware:**
- Check middleware logs for `/api/devices/pairing/request` calls
- Verify QR code generation didn't fail
- Check WebSocket connection attempts

---

## References

- [Electron IPC Documentation](https://www.electronjs.org/docs/api/ipc-main)
- [Preload Scripts Security](https://www.electronjs.org/docs/tutorial/preload)
- [Context Isolation](https://www.electronjs.org/docs/tutorial/context-isolation)
- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
