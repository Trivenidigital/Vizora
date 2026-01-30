# Vizora System - Verification Checklist

Use this checklist to verify all components of your Vizora system are working correctly after the Electron app fix.

---

## ✅ Phase 1: Prerequisites

### Environment & Tools
- [ ] Node.js installed (`node --version` returns 18+)
- [ ] npm installed (`npm --version` returns 8+)
- [ ] PostgreSQL running locally
- [ ] Git installed (optional, for version control)

### Database
- [ ] PostgreSQL service is running
- [ ] Database `vizora` exists
- [ ] User `vizora_user` exists with password `vizora_pass`
- [ ] Tables are created (migrations ran)

**Verify with:**
```bash
psql -h localhost -U vizora_user -d vizora -c "SELECT table_name FROM information_schema.tables;"
```

### Environment Files
- [ ] `/vizora/.env` exists with required variables
- [ ] `/vizora/middleware/.env` exists
- [ ] Database URL is correct in `.env` files
- [ ] JWT_SECRET is 32+ characters

---

## ✅ Phase 2: Code Changes

### Files Modified
- [ ] `display/src/app/app.element.ts` - connectedCallback() is now a no-op (disabled)
- [ ] `display/src/electron/main.ts` - Has preload logging and sandbox security

**Verify:**
```bash
grep -n "Do nothing" C:\Projects\vizora\vizora\display\src\app\app.element.ts
# Should find: "// Do nothing - let the actual display app handle everything"

grep -n "sandbox: true" C:\Projects\vizora\vizora\display\src\electron\main.ts
# Should find: sandbox setting in webPreferences
```

---

## ✅ Phase 3: Build Verification

### Display App Build

```bash
cd C:\Projects\vizora\vizora\display

# Clean previous build
rm -r dist/

# Install dependencies
npm install

# Build everything
npm run build
```

**Verify output:**
- [ ] `dist/electron/main.js` created
- [ ] `dist/electron/preload.js` created (not empty)
- [ ] `dist/renderer/app.js` created
- [ ] `dist/renderer/index.html` created and contains pairing UI
- [ ] No build errors in console

**Check files:**
```bash
# All these should exist and be non-empty
ls -lh dist/electron/main.js
ls -lh dist/electron/preload.js
ls -lh dist/renderer/app.js
ls -lh dist/renderer/index.html

# HTML should contain pairing screen elements
grep -c "Welcome to Vizora" dist/renderer/index.html
# Should return: 1 (found once)

grep -c "pairing-code" dist/renderer/index.html
# Should return: 1 (found once)
```

---

## ✅ Phase 4: Middleware Build & Start

### Build Middleware

```bash
cd C:\Projects\vizora\vizora\middleware

npm install
npm run build
```

**Verify:**
- [ ] Build completes without errors
- [ ] `dist/` directory created
- [ ] No TypeScript compilation errors

### Start Middleware

```bash
npm run dev
```

**Expected console output:**
- [ ] "Starting Nest application..."
- [ ] "Nest application successfully started"
- [ ] "Application is running on: http://localhost:3000"
- [ ] No errors about database connection
- [ ] No errors about modules

**Verify API is responding:**
```bash
# In a separate terminal
curl http://localhost:3000/api/health
# Should return: 200 OK
```

---

## ✅ Phase 5: WebSocket/Realtime Server

### Start Realtime Server

```bash
cd C:\Projects\vizora\vizora\realtime

npm install
npm run dev
```

**Expected output:**
- [ ] Server starts on port 3002
- [ ] "WebSocket server ready" or similar message
- [ ] No connection errors

**Verify it's running:**
```bash
# Windows
netstat -ano | findstr :3002
# Should show: LISTENING

# Linux/Mac
lsof -i :3002
# Should show port 3002 active
```

---

## ✅ Phase 6: Electron Display Client

### Start Display App

```bash
cd C:\Projects\vizora\vizora\display

# Clear NODE_OPTIONS if set
unset NODE_OPTIONS

# Start the app
npm start
```

**Console output should show:**
```
[Main] Loading preload script from: .../dist/electron/preload.js
[Preload] Initializing electronAPI...
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
[Main] Renderer loaded, initializing device client...
```

**Window should appear:**
- [ ] Electron window opens (1200x800)
- [ ] Black background
- [ ] "Welcome to Vizora" heading visible
- [ ] 6-digit pairing code displayed (e.g., `A1B2C3`)
- [ ] QR code image visible
- [ ] Loading spinner with "Waiting for pairing..." text
- [ ] No blank screens
- [ ] No NX boilerplate content
- [ ] No JavaScript errors visible

### DevTools Verification

Press `Ctrl+Shift+I` to open DevTools:

**Console Tab:**
- [ ] No JavaScript errors
- [ ] No CORS errors
- [ ] See messages like: `[Preload] ✅ electronAPI exposed`
- [ ] See message: `[App] electronAPI initialized successfully`

**Elements Tab:**
- [ ] Can inspect `<div id="app">` element
- [ ] Can see `<div id="pairing-screen"` is visible (no hidden class)
- [ ] Can see `<div id="qr-code">` with `<img>` element
- [ ] Can see `<div id="pairing-code">` with 6-digit code

**Network Tab:**
- [ ] See request to `http://localhost:3000/api/devices/pairing/request`
- [ ] Response status is `200 OK`
- [ ] Response contains `{ code: "...", qrCode: "data:image/png;..." }`

**Command in Console:**
```javascript
typeof window.electronAPI
// Should return: "object"

window.electronAPI.getPairingCode()
  .then(r => console.log("Pairing code response:", r))
  .catch(e => console.error("Error:", e))

// Should log the pairing code and QR code data
```

---

## ✅ Phase 7: API Connectivity

### Verify Middleware Endpoints

```bash
# Pairing endpoint
curl -X POST http://localhost:3000/api/devices/pairing/request \
  -H "Content-Type: application/json" \
  -d '{"deviceIdentifier":"test-device","nickname":"test"}'
# Should return: { code: "...", qrCode: "...", ... }

# Health check
curl http://localhost:3000/api/health
# Should return: 200 OK

# Auth endpoint (optional test)
curl http://localhost:3000/api/auth/status
# Should return: 401 Unauthorized (expected - no token)
```

### Verify WebSocket

- [ ] Realtime server is running on port 3002
- [ ] After pairing, Electron app connects via WebSocket
- [ ] No connection timeout errors

---

## ✅ Phase 8: IPC Communication

### Test in DevTools Console

```javascript
// Test 1: IPC method exists
window.electronAPI.getDeviceInfo()
  .then(info => console.log("Device info:", info))
  .catch(e => console.error("Error:", e))

// Should show something like:
// Device info: {platform: "win32", arch: "x64", version: "0.0.1", ...}

// Test 2: Get pairing code (main test)
window.electronAPI.getPairingCode()
  .then(result => console.log("Success:", result))
  .catch(e => console.error("Failed:", e))

// Should show:
// Success: {code: "ABC123", qrCode: "data:image/png;base64,..."}
```

**Verify:**
- [ ] Both methods complete without errors
- [ ] IPC communication works both ways
- [ ] Pairing code is returned correctly

---

## ✅ Phase 9: Device Pairing (Optional)

### Pair a Device

1. **Note the pairing code** shown in Electron window (e.g., `ABC123`)

2. **Open web browser:**
   - Go to `http://app.vizora.com/devices/pair` (or your pairing URL)
   - OR use a test interface if available

3. **Enter or scan:**
   - [ ] Enter the 6-digit code, OR
   - [ ] Scan the QR code with a mobile device

4. **Complete pairing:**
   - [ ] Backend marks device as paired
   - [ ] Device receives pairing token

5. **Verify in Electron:**
   - [ ] Pairing screen disappears
   - [ ] Content screen appears (may be black if no content scheduled)
   - [ ] Console shows "Device paired successfully"
   - [ ] WebSocket connection established
   - [ ] No errors in console

---

## ✅ Phase 10: Full System Test

### End-to-End Test

1. **All services running:**
   - [ ] PostgreSQL ✓
   - [ ] Middleware API ✓
   - [ ] Realtime WebSocket ✓
   - [ ] Electron Display Client ✓

2. **User sees:**
   - [ ] Pairing screen on app launch
   - [ ] Valid 6-digit code
   - [ ] Valid QR code image
   - [ ] "Waiting for pairing..." message

3. **Backend receives:**
   - [ ] Pairing request in logs
   - [ ] Device identifier stored
   - [ ] Pairing code generated

4. **IPC communication works:**
   - [ ] Can call `getPairingCode()` from console
   - [ ] Can call `getDeviceInfo()` from console
   - [ ] Responses are received correctly

---

## ✅ Phase 11: Error States

### Test Error Handling

**Test 1: No Backend**
1. Stop middleware with `Ctrl+C`
2. Watch Electron console
3. **Verify:** Shows error trying to connect to localhost:3000
4. Restart middleware

**Test 2: No WebSocket**
1. Stop realtime server with `Ctrl+C`
2. Try to pair a device
3. **Verify:** Pairing completes, but WebSocket connection fails/retries
4. Restart realtime server

**Test 3: Invalid Credentials**
1. Change database password in `.env`
2. Restart middleware
3. **Verify:** Middleware fails to start with database error
4. Revert changes

---

## ✅ Phase 12: Performance

### Check Resource Usage

**Open Task Manager (Windows):**
- [ ] Middleware process: ~100-150 MB RAM
- [ ] Electron process: ~150-200 MB RAM
- [ ] Total: ~300-400 MB

**Check Response Times:**
- [ ] Pairing request: <1 second
- [ ] Device info: <500ms
- [ ] WebSocket connection: <2 seconds

---

## ✅ Final Verification Summary

### All Checks Complete?

**Count your checkmarks above:**
- Total checkmarks: _____ / 110

### Success Criteria

- [ ] All Phase 1-7 checks complete (prerequisites through API)
- [ ] Electron app shows pairing screen with code + QR
- [ ] IPC communication works
- [ ] DevTools console shows no errors
- [ ] API endpoints respond correctly

### If Not All Passing

**Check troubleshooting guides:**
- `display/BUILD_AND_RUN.md` - Display app specific issues
- `FULL_STARTUP_GUIDE.md` - System startup issues
- `ELECTRON_FIX_GUIDE.md` - Technical debugging details

---

## 📋 Quick Reference

### Services Status Check

```bash
# Middleware health
curl http://localhost:3000/api/health

# WebSocket port check
netstat -ano | findstr :3002  # Windows
lsof -i :3002                 # Linux/Mac

# Database connection
psql -h localhost -U vizora_user -d vizora -c "SELECT 1"

# Electron app
# Just check the window appears and shows pairing screen
```

### Key Logs to Check

1. **Middleware Console:** Shows API requests and responses
2. **Electron Console (DevTools):** Shows app initialization and errors
3. **Database:** Can query `SELECT * FROM "Device";` to see registered devices

---

## 🎉 Completion

When all checks are passing, your Vizora system is fully operational:

- ✅ Electron Display Client: Working
- ✅ Backend API: Responding
- ✅ Database: Connected
- ✅ WebSocket: Ready
- ✅ Device Pairing: Enabled
- ✅ Content Display: Ready

**Congratulations!** Your Vizora Digital Signage system is ready to use.
