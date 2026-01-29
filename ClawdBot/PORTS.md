# Port Assignment Reference

**STRICT PORT POLICY:** Each service has a dedicated port and will **FAIL TO START** if that port is occupied.

## Port Assignments

| Service | Port | Purpose | Fail Behavior |
|---------|------|---------|---------------|
| **Middleware** | **3000** | REST API Backend | Exit with error if occupied |
| **Web** | **3001** | Next.js Frontend | Exit with error if occupied |
| **Realtime** | **3002** | WebSocket Gateway | Exit with error if occupied |

## Why Fixed Ports?

1. **Predictability** - Always know where each service is
2. **No conflicts** - Services refuse to start on wrong port
3. **Clear errors** - Immediate feedback if port is taken
4. **Simplified config** - No dynamic port resolution needed

## Checking Port Availability

### Windows (PowerShell)
```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process using port 3000 (if needed)
# Find PID from netstat output, then:
taskkill /PID <PID> /F
```

### Linux/Mac
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process using port 3000
kill -9 $(lsof -t -i:3000)
```

## Starting Services

### Development Mode
```bash
# Terminal 1 - Middleware (port 3000)
cd middleware
pnpm nx build @vizora/middleware
node dist/main.js

# Terminal 2 - Web (port 3001)
cd web
PORT=3001 pnpm dev

# Terminal 3 - Realtime (port 3002)
cd realtime
pnpm nx build @vizora/realtime
node dist/main.js
```

### Production Mode
```bash
# Use Docker Compose (all services start with correct ports)
docker-compose up -d
```

## Troubleshooting

### Error: "Cannot bind to port 3000"

**Cause:** Another process is using port 3000

**Solution:**
1. Find the process: `netstat -ano | findstr :3000`
2. Identify PID in last column
3. Stop it: `taskkill /PID <PID> /F`
4. Retry starting middleware

### Service starts but uses wrong port

**This should NEVER happen** - services are hardcoded to specific ports and will exit if configured differently.

If this occurs:
1. Check .env file - ensure ports match table above
2. Check for PORT environment variable overrides
3. File a bug - this is a configuration error

## Configuration Files

- `.env` - Sets `MIDDLEWARE_PORT`, `WEB_PORT`, `REALTIME_PORT`
- `middleware/src/main.ts` - Enforces port 3000
- `realtime/src/main.ts` - Enforces port 3002
- `web/next.config.js` - Uses `process.env.WEB_PORT || 3001`

## Port Change Policy

**DO NOT CHANGE PORTS** unless you have a very good reason (e.g., conflict with system service).

If you must change:
1. Update this document first
2. Update all affected services
3. Update all configuration files
4. Update all documentation
5. Test thoroughly

**Common mistakes that are now prevented:**
- ❌ Middleware accidentally starting on 3001
- ❌ Two services fighting for same port
- ❌ Dynamic port selection causing confusion
- ❌ "Which port is middleware on?" questions

**What happens now:**
- ✅ Service exits immediately if port is taken
- ✅ Clear error message with instructions
- ✅ No ambiguity about port assignments
- ✅ Easy to diagnose port conflicts
