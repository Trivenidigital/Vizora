# Complete Vizora System - Full Startup Guide

## System Overview

The Vizora system consists of 4 main components that must run together:

```
┌─────────────────────────────────────────────────────────┐
│         Vizora Display Client (Electron)                │
│         Port: Dev Window (no specific port)             │
│         - Pairing screen with QR code                   │
│         - Full-screen content display                   │
│         - IPC communication with backend                │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│    Vizora Middleware (NestJS Backend API)               │
│         Port: 3000                                      │
│    - Authentication & Device Pairing                    │
│    - Playlist/Content Management                        │
│    - REST API endpoints                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
   ┌─────────────┐   ┌──────────────┐
   │ PostgreSQL  │   │  Realtime    │
   │ Port: 5432  │   │  WebSocket   │
   │             │   │  Port: 3002  │
   │ Database    │   │              │
   │ Storage     │   │  Live Stream │
   └─────────────┘   └──────────────┘
```

---

## Prerequisites

### 1. Node.js & npm
```bash
node --version  # Should be 18+
npm --version   # Should be 8+
```

### 2. PostgreSQL Database
- **Status:** Running on `localhost:5432`
- **Database:** `vizora`
- **User:** `vizora_user`
- **Password:** `vizora_pass`

**Verify:**
```bash
psql -h localhost -U vizora_user -d vizora -c "SELECT 1;"
```

### 3. Environment Files

Ensure these files exist with proper configuration:

#### `/vizora/.env` (Root)
```bash
NODE_ENV=development
PORT=3000
MIDDLEWARE_PORT=3000
WEB_PORT=3001
REALTIME_PORT=3002

DATABASE_URL=postgresql://vizora_user:vizora_pass@localhost:5432/vizora

JWT_SECRET=vizora-dev-secret-key-change-in-production-32chars
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3002,http://localhost:3000
```

#### `/vizora/middleware/.env`
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://vizora_user:vizora_pass@localhost:5432/vizora
JWT_SECRET=vizora-dev-secret-key-change-in-production-32chars
```

#### `/vizora/display/.env` (if needed)
```bash
NODE_ENV=development
API_URL=http://localhost:3000
REALTIME_URL=ws://localhost:3002
```

---

## Step-by-Step Startup

### Terminal 1: PostgreSQL Database

**Windows:**
```bash
# PostgreSQL should be running as a service
# Check if running:
tasklist | findstr postgres

# If not running, start the service:
net start postgresql-x64-15  # (or your version)

# OR use command line:
"C:\Program Files\PostgreSQL\15\bin\pg_ctl" -D "C:\Program Files\PostgreSQL\15\data" start
```

**Linux/Mac:**
```bash
# Start PostgreSQL service
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Verify:
pg_isready
```

**Verify database exists:**
```bash
psql -h localhost -U vizora_user -d vizora -c "\dt"
# Should show tables: users, organizations, displays, content, etc.
```

---

### Terminal 2: Middleware API Server

```bash
# Navigate to middleware
cd C:\Projects\vizora\vizora\middleware

# Install dependencies (first time only)
npm install

# Build TypeScript
npm run build

# Start in development mode
npm run dev
```

**Expected output:**
```
[Nest] 12345  - 01/29/2026 21:30:00     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/29/2026 21:30:01     LOG [InstanceLoader] DatabaseModule dependencies initialized
[Nest] 12345  - 01/29/2026 21:30:01     LOG [InstanceLoader] ConfigModule dependencies initialized
...
[Nest] 12345  - 01/29/2026 21:30:02     LOG [NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
```

**Verify API is working:**
```bash
# In a separate terminal:
curl http://localhost:3000/api/health
# Should return: 200 OK
```

---

### Terminal 3: Realtime WebSocket Server

```bash
# Navigate to realtime
cd C:\Projects\vizora\vizora\realtime

# Install dependencies (first time only)
npm install

# Start in development mode
npm run dev
```

**Expected output:**
```
[Realtime Server] Starting on port 3002...
[Realtime Server] ✅ WebSocket server ready
```

**Verify it's running:**
```bash
# In a separate terminal:
netstat -ano | findstr :3002  # Windows
lsof -i :3002                # Linux/Mac
# Should show port 3002 in LISTENING state
```

---

### Terminal 4: Vizora Display Client (Electron)

```bash
# Navigate to display app
cd C:\Projects\vizora\vizora\display

# Make sure build is up to date
npm run build

# Start Electron app
unset NODE_OPTIONS && npm start
```

**Expected output:**
```
[Main] Loading preload script from: .../dist/electron/preload.js
[Preload] Initializing electronAPI...
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
[Main] Renderer loaded, initializing device client...
```

**Electron window should appear with:**
- Black screen initially (loading)
- "Welcome to Vizora" heading
- 6-digit pairing code (e.g., `A1B2C3`)
- QR code image
- "Waiting for pairing..." spinner

---

## Verification Checklist

After all services are running, verify everything works:

### ✅ Check 1: Middleware API

```bash
curl http://localhost:3000/api/health
# Response: { "status": "ok" }
```

### ✅ Check 2: Display App Console

In Electron DevTools (Ctrl+Shift+I):

**Should see:**
```javascript
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
[RENDERER-INFO] [App] electronAPI initialized successfully
```

**Should NOT see:**
```javascript
❌ window.electronAPI is undefined
❌ Cannot POST /api/devices/pairing/request
❌ CORS error
```

### ✅ Check 3: API Call to Backend

In Electron DevTools Console:

```javascript
window.electronAPI.getPairingCode()
  .then(r => console.log('Pairing code:', r))
  .catch(e => console.error('Error:', e))
```

**Should show:**
```javascript
Pairing code: {
  code: "A1B2C3",
  qrCode: "data:image/png;base64,..."
}
```

**If error shows, check:**
- Middleware is running on port 3000
- `/api/devices/pairing/request` endpoint exists
- CORS is configured for localhost

### ✅ Check 4: Display Shows Pairing Screen

**In Electron window:**
- [ ] See "Welcome to Vizora" heading
- [ ] See 6-digit code displayed
- [ ] See QR code image
- [ ] See "Waiting for pairing..." message
- [ ] No blank/white screens
- [ ] No NX boilerplate content

---

## Pairing a Device

Once the pairing screen appears with a code:

1. **Note the code** displayed (e.g., `ABC123`)

2. **Open web browser:**
   ```
   http://app.vizora.com/devices/pair
   ```

3. **Enter the code** OR scan the QR code

4. **Complete pairing** in the web interface

5. **Check Electron window:**
   - Pairing screen should disappear
   - Content screen should appear (black or with content)
   - Check console: Should see connection to WebSocket

**If pairing doesn't work:**
- Check middleware logs for pairing request
- Check frontend logs for API responses
- Verify backend has `/api/devices/pairing/request` endpoint

---

## Shutdown Procedure

**To cleanly shut down the system:**

### Stop Each Terminal (in reverse order)

1. **Terminal 4 - Display Client**
   ```bash
   Close the Electron window OR
   Press Ctrl+C in the terminal
   ```

2. **Terminal 3 - Realtime Server**
   ```bash
   Press Ctrl+C
   # Should show: Server shutdown gracefully
   ```

3. **Terminal 2 - Middleware**
   ```bash
   Press Ctrl+C
   # Should show: Application terminated
   ```

4. **Terminal 1 - PostgreSQL**
   ```bash
   # Windows:
   net stop postgresql-x64-15

   # Linux/Mac:
   brew services stop postgresql
   ```

---

## Troubleshooting

### Problem: "Cannot connect to database"

**Check:**
```bash
psql -h localhost -U vizora_user -d vizora -c "SELECT 1;"
```

**Fix:**
1. Ensure PostgreSQL is running
2. Verify credentials in `.env`
3. Ensure database `vizora` exists
4. Check user `vizora_user` has permissions

---

### Problem: "Port 3000 already in use"

```bash
# Windows: Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F

# Linux/Mac:
lsof -i :3000
kill -9 <PID>
```

---

### Problem: Electron shows blank screen

**Check in this order:**

1. **Is backend running?**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Check Electron console:**
   - DevTools should show success messages
   - Look for API request logs

3. **Check Network tab in DevTools:**
   - Should see POST to `/api/devices/pairing/request`
   - Should see 200 response

4. **Rebuild if needed:**
   ```bash
   cd display && npm run build && npm start
   ```

---

### Problem: "NODE_OPTIONS is not allowed"

This is an environment variable issue:

```bash
# Clear it temporarily for this command
unset NODE_OPTIONS && npm start
```

**To permanently fix:**

**Windows:**
- Remove `NODE_OPTIONS` from System Environment Variables
- Or set it to empty value
- Restart terminal

**Linux/Mac:**
- Edit `~/.bashrc` or `~/.zshrc`
- Remove any `export NODE_OPTIONS=...` lines
- Restart terminal

---

## Development vs Production

### Development Mode

```bash
# Terminal 1: Backend with auto-reload
npm run dev

# Terminal 2: Electron with DevTools open
npm start
```

**Features:**
- DevTools open automatically
- Console logging enabled
- Source maps for debugging
- Hot reload (restart needed for main.ts changes)

### Production Mode

```bash
# Build for production
NODE_ENV=production npm run build

# Run with minimal logging
npm start
```

**Features:**
- DevTools closed
- Logging disabled
- Smaller bundle size
- Optimized performance

---

## Common Issues & Solutions

| Issue | Check | Solution |
|-------|-------|----------|
| Blank Electron window | Middleware running? | Start middleware on port 3000 |
| No pairing code shown | Backend responding? | Check `/api/devices/pairing/request` |
| QR code not visible | Browser console logs | Rebuild with `npm run build` |
| API call fails | CORS configured? | Check middleware CORS settings |
| Port already in use | What's using the port? | Kill the process or change port |
| Database error | PostgreSQL running? | Start PostgreSQL service |
| WebSocket won't connect | Realtime server running? | Start on port 3002 |

---

## Monitoring & Logs

### Middleware Logs
```bash
# Tail the logs in real-time
tail -f logs/application.log

# Watch for:
# ✅ Pairing requests received
# ✅ Device connections
# ❌ Database errors
# ❌ API failures
```

### Electron Console
```javascript
// DevTools shows all app logs
// Look for:
✓ [App] electronAPI initialized
✓ [API] Response: 200 OK
✗ [API] Request failed: 500 Error
```

### WebSocket Activity
```bash
# Monitor WebSocket connections
# In middleware logs, should see:
✓ Device connected via WebSocket
✓ Heartbeat received
✗ Connection timeout
```

---

## Performance Notes

- **Initial startup:** 5-10 seconds (all services)
- **Pairing request:** <1 second (if API responsive)
- **Content display:** <500ms after pairing
- **Typical memory:**
  - Middleware: 100-150MB
  - Display Client: 150-200MB
  - Total: ~300-400MB

---

## Next Steps

1. **Start all services** following the guide above
2. **Verify** pairing screen appears
3. **Check console** for any errors
4. **Pair a device** using the code
5. **Test content** playback

See `display/BUILD_AND_RUN.md` for display-only build details.
See `ELECTRON_FIX_GUIDE.md` for technical implementation details.
