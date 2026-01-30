# Quick Start: Build & Run Vizora Display Client

## TL;DR - Quick Commands

```bash
# Navigate to display app
cd C:\Projects\vizora\vizora\display

# Clean build
rm -r dist/

# Build everything
npm run build

# Run the app
npm start
```

Expected result: Electron window opens with **pairing screen** showing 6-digit code and QR code.

---

## Step-by-Step Build Process

### Step 1: Ensure All Services Running

Before building, make sure these are running:

- ✅ **Backend Middleware** (port 3000)
  ```bash
  cd C:\Projects\vizora\vizora\middleware
  npm run dev
  ```

- ✅ **Database** (PostgreSQL on localhost:5432)
  ```bash
  # Windows: Start PostgreSQL service
  # Linux/Mac: brew services start postgresql
  ```

- ✅ **WebSocket Realtime Server** (port 3002)
  ```bash
  cd C:\Projects\vizora\vizora\realtime
  npm run dev
  ```

### Step 2: Build Display App

```bash
cd C:\Projects\vizora\vizora\display

# Install/update dependencies
npm install

# Clean previous build
rm -r dist/ 2>/dev/null || true

# Build renderer and electron processes
npm run build
```

**What happens:**
- `webpack` compiles `src/renderer/app.ts` → `dist/renderer/app.js`
- `tsc` compiles `src/electron/*.ts` → `dist/electron/`
- HtmlWebpackPlugin generates `dist/renderer/index.html`

**Output should show:**
```
dist/electron/main.js
dist/electron/preload.js
dist/renderer/app.js
dist/renderer/index.html
✅ Build successful
```

### Step 3: Run the Application

```bash
npm start
```

**Expected output in console:**
```
[Electron] Starting app...
[Main] Window created at 1200x800
[Main] Loading preload script from: <path>/dist/electron/preload.js
[Preload] Initializing electronAPI...
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
[Main] Renderer loaded, initializing device client...
```

**Expected window content:**
- Large heading: "Welcome to Vizora"
- Large 6-digit code below (e.g., `A1B2C3`)
- QR code image
- "Enter this code at app.vizora.com/devices/pair"
- Loading spinner with "Waiting for pairing..."

---

## Troubleshooting Quick Fixes

### Problem: Still Showing Blank Screen

**Fix 1: Rebuild completely**
```bash
rm -r dist/
npm run build
npm start
```

**Fix 2: Check preload script compiled**
```bash
# Should exist and not be empty
ls -lh dist/electron/preload.js
```

**Fix 3: Clear Electron cache**
```bash
rm -r ~/.config/vizora-display/  # Linux
rm -r ~/Library/Application\ Support/vizora-display/  # macOS
rmdir /s %APPDATA%\vizora-display\  # Windows
```

---

### Problem: "Cannot connect to localhost:3000"

**Check 1: Is middleware running?**
```bash
curl http://localhost:3000/api/health
# Should return 200 OK
```

**Check 2: Port conflict**
```bash
# Windows: Check what's using port 3000
netstat -ano | findstr :3000

# Kill if needed
taskkill /PID <PID> /F
```

**Check 3: Start middleware**
```bash
cd ../middleware
npm run dev
```

---

### Problem: No QR Code Showing

**Check:** Backend returning QR code
```bash
# In DevTools Console:
window.electronAPI.getPairingCode().then(r => console.log(r))
# Should show: { code: "ABC123", qrCode: "data:image/png;..." }
```

**If missing:** Backend issue, check middleware logs

---

### Problem: "Cannot find module" errors

```bash
# Reinstall dependencies
rm -r node_modules/ package-lock.json
npm install

# Rebuild
npm run build
npm start
```

---

## Development Workflow

### During Development

For faster iteration during development:

```bash
# Terminal 1: Run dev server for hot reloading
npm run dev

# Terminal 2: In separate window, start electron
npm start
```

This uses `http://localhost:4200` dev server instead of built files.

### Production Ready

For a production/release build:

```bash
NODE_ENV=production npm run build
npm start
```

This:
- Minifies code
- Disables DevTools
- Optimizes bundle size
- Sets production security headers

---

## Key Changes Made

These files were modified to fix the blank screen issue:

### 1. `src/app/app.element.ts` - DISABLED
- **Before:** Rendered NX boilerplate HTML
- **After:** No-op custom element (disabled)
- **Why:** Was hijacking DOM and preventing display app from initializing

### 2. `src/electron/main.ts` - IMPROVED
- **Before:** No preload logging
- **After:** Added logging and sandbox security
- **Why:** Better debugging and security

No changes needed to:
- `src/renderer/app.ts` (main display logic)
- `src/renderer/index.html` (UI template)
- `src/electron/preload.ts` (IPC bridge)
- `src/electron/device-client.ts` (API client)

---

## Verifying the Fix Works

### DevTools Checklist

Open DevTools: `Ctrl+Shift+I` or `View → Toggle Developer Tools`

**Check Console Tab:**
```javascript
// Should see these messages:
✓ [Preload] Initializing electronAPI...
✓ [Preload] ✅ electronAPI exposed successfully
✓ [App] electronAPI initialized successfully
✓ [Main] Renderer loaded, initializing device client...

// Should NOT see errors like:
✗ window.electronAPI is undefined
✗ Cannot POST /api/devices/pairing/request
✗ CORS error
```

**Check Elements/Inspector:**
```html
<!-- Should see this structure: -->
<div id="app">
  <div id="pairing-screen" class="">  <!-- NOT hidden -->
    <h1>Welcome to Vizora</h1>
    <div id="qr-code" class="">       <!-- Shows QR image -->
      <img src="data:image/png;..." alt="QR Code" />
    </div>
    <div id="pairing-code">
      A1B2C3  <!-- 6-digit code -->
    </div>
    ...
  </div>
</div>
```

### Network Tab Check

**Should see successful requests:**
```
POST http://localhost:3000/api/devices/pairing/request  [200 OK]
```

**Should NOT see:**
```
❌ CORS error
❌ 404 Not Found
❌ Connection refused
```

---

## Pairing Device

Once the app shows the pairing screen:

1. **Note the 6-digit code** (e.g., `A1B2C3`)
2. **Open web browser** and go to `app.vizora.com/devices/pair`
3. **Enter code** OR scan QR code with phone
4. **Complete pairing** in web interface
5. **Device automatically** connects and starts showing content

---

## Advanced Build Options

### Build Renderer Only
```bash
npm run webpack
# Output: dist/renderer/
```

### Build Electron Only
```bash
npx tsc -p tsconfig.electron.json
# Output: dist/electron/
```

### Build with Source Maps
```bash
npm run build
# Automatically includes .js.map files for debugging
```

### Package for Distribution
```bash
npm run build
npx electron-builder --publish never  # Don't upload to GitHub
# Output: Vizora Display Client-0.0.1.exe (on Windows)
```

---

## Need More Help?

See the detailed guide: `ELECTRON_FIX_GUIDE.md`

Key sections:
- Architecture overview
- Expected behavior after fix
- Debugging checklist
- Security warnings (safe to ignore)
- Environment configuration
- File structure reference
