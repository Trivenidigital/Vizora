# Vizora Service Manager MCP Server

**MCP server for managing Vizora services (middleware, web, realtime)**

## Features

🚀 **Service Control**
- Start/stop/restart services
- Check service status
- View running PIDs

🔍 **Port Management**
- Check port availability
- Kill processes on specific ports
- Monitor port usage

📋 **Logging** (Coming Soon)
- View recent service logs
- Tail logs in real-time

---

## Installation

```bash
cd mcp-servers/vizora-service-manager
pnpm install
pnpm build
```

---

## Available Tools

### 1. `vizora_service_status`
Get status of all Vizora services.

**Input:** None

**Output:**
```json
{
  "middleware": { "status": "running", "port": 3000, "pid": 12345 },
  "web": { "status": "running", "port": 3001, "pid": 12346 },
  "realtime": { "status": "stopped", "port": 3002, "pid": null }
}
```

### 2. `vizora_service_start`
Start a specific service.

**Input:**
```json
{
  "service": "middleware" // or "web" or "realtime"
}
```

**Output:**
```
Service 'middleware' started successfully on port 3000
```

### 3. `vizora_service_stop`
Stop a specific service.

**Input:**
```json
{
  "service": "middleware"
}
```

**Output:**
```
Service 'middleware' stopped (PID: 12345)
```

### 4. `vizora_service_restart`
Restart a specific service.

**Input:**
```json
{
  "service": "web"
}
```

**Output:**
```
Service 'web' stopped (PID: 12346)
Service 'web' started successfully on port 3001
```

### 5. `vizora_port_check`
Check if ports are in use.

**Input:**
```json
{
  "ports": [3000, 3001, 3002, 5432] // optional, defaults to [3000, 3001, 3002]
}
```

**Output:**
```json
{
  "3000": true,  // in use
  "3001": false, // available
  "3002": true,
  "5432": true
}
```

### 6. `vizora_port_kill`
Kill process using a specific port.

**Input:**
```json
{
  "port": 3000
}
```

**Output:**
```
Killed process 12345 on port 3000
```

### 7. `vizora_service_logs`
Get recent logs from a service (placeholder).

**Input:**
```json
{
  "service": "middleware",
  "lines": 50 // optional, defaults to 50
}
```

**Output:**
```
Logs for 'middleware' (last 50 lines):

[Log tailing not yet implemented - would require proper logging infrastructure]
```

---

## Configuration

### Clawdbot Integration

Add to your Clawdbot config (`~/.clawdbot/config.json`):

```json
{
  "mcpServers": {
    "vizora-service-manager": {
      "command": "node",
      "args": [
        "C:/Projects/vizora/vizora/mcp-servers/vizora-service-manager/dist/index.js"
      ]
    }
  }
}
```

### Service Paths

Services are configured in `src/index.ts`:

```typescript
const SERVICES = {
  middleware: {
    name: "middleware",
    port: 3000,
    startCmd: "cd C:\\Projects\\vizora\\vizora && pnpm nx serve middleware",
    dir: "C:\\Projects\\vizora\\vizora\\middleware",
  },
  // ...
};
```

Modify these paths if your Vizora installation is in a different location.

---

## Usage Examples

### Check Service Status
```typescript
// AI assistant calls:
vizora_service_status()

// Response:
{
  "middleware": { "status": "running", "port": 3000, "pid": 12345 },
  "web": { "status": "stopped", "port": 3001, "pid": null },
  "realtime": { "status": "running", "port": 3002, "pid": 12347 }
}
```

### Start Web Service
```typescript
vizora_service_start({ service: "web" })

// Response: Service 'web' started successfully on port 3001
```

### Restart Middleware
```typescript
vizora_service_restart({ service: "middleware" })

// Response:
// Service 'middleware' stopped (PID: 12345)
// Service 'middleware' started successfully on port 3000
```

### Kill Port 3000
```typescript
vizora_port_kill({ port: 3000 })

// Response: Killed process 12345 on port 3000
```

---

## Testing

### Manual Testing

```bash
# Build the server
pnpm build

# Test manually (will wait for stdin)
node dist/index.js

# Send MCP request:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### With Clawdbot

1. Add to Clawdbot config (see above)
2. Restart Clawdbot: `clawdbot gateway restart`
3. Test in chat:
   - "Check Vizora service status"
   - "Start the middleware service"
   - "What's running on port 3000?"

---

## BMAD Status

### ✅ Build Phase (Complete)
- [x] Project structure created
- [x] Dependencies installed
- [x] TypeScript configured
- [x] All 7 tools implemented
- [x] Error handling added
- [x] Documentation written

### 🔄 Measure Phase (In Progress)
- [ ] Test each tool manually
- [ ] Measure response times
- [ ] Test error scenarios
- [ ] Verify Windows compatibility

### ⏳ Analyze Phase (Pending)
- [ ] Review logs for errors
- [ ] Identify edge cases
- [ ] Document limitations
- [ ] Performance analysis

### ⏳ Deploy Phase (Pending)
- [ ] Add to Clawdbot config
- [ ] Test with AI assistant
- [ ] Update main documentation
- [ ] Create CHANGELOG

---

## Limitations

1. **Service Start Detection:** Waits 3 seconds after starting service to verify. May need adjustment.
2. **Log Tailing:** Not yet implemented. Requires proper logging infrastructure.
3. **Windows Only:** Uses `netstat` and `taskkill` (Windows commands).
4. **No Service Dependencies:** Doesn't handle service dependencies (e.g., PostgreSQL for middleware).
5. **Background Processes:** Started services run detached but may not persist after terminal closes.

---

## Future Enhancements

- [ ] Real log tailing (integrate with Winston/Pino)
- [ ] Service health checks (HTTP ping)
- [ ] Service dependencies management
- [ ] Cross-platform support (Linux/macOS)
- [ ] Service metrics (uptime, restarts)
- [ ] Batch operations (start all, stop all)
- [ ] Auto-restart on crash
- [ ] Environment variable management

---

## Contributing

Follow BMAD methodology for all changes:
1. **Build:** Implement feature
2. **Measure:** Test thoroughly
3. **Analyze:** Review results
4. **Deploy:** Integrate and document

---

## License

MIT

---

**Created:** 2026-01-28  
**Status:** 🟡 Build Complete, Testing In Progress  
**Next:** Manual testing and Clawdbot integration
