# Manual Testing Guide - Service Manager MCP

## Prerequisites
- Build complete: `pnpm build`
- Vizora services may or may not be running

## Test 1: Service Status ✅
**Tool:** `vizora_service_status`

```bash
# Test command (via MCP client)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "vizora_service_status",
    "arguments": {}
  }
}
```

**Expected Output:**
```json
{
  "middleware": { "status": "running|stopped", "port": 3000, "pid": 12345|null },
  "web": { "status": "running|stopped", "port": 3001, "pid": 12346|null },
  "realtime": { "status": "running|stopped", "port": 3002, "pid": 12347|null }
}
```

**Success Criteria:**
- ✅ Returns JSON with all 3 services
- ✅ Status is either "running" or "stopped"
- ✅ PID is a number when running, null when stopped
- ✅ Response time < 1 second

---

## Test 2: Port Check ✅
**Tool:** `vizora_port_check`

```bash
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "vizora_port_check",
    "arguments": {
      "ports": [3000, 3001, 3002, 5432]
    }
  }
}
```

**Expected Output:**
```json
{
  "3000": true,  // boolean
  "3001": false,
  "3002": true,
  "5432": true
}
```

**Success Criteria:**
- ✅ Returns boolean for each port
- ✅ Accurate (verify with `netstat -ano | findstr :3000`)
- ✅ Response time < 500ms

---

## Test 3: Start Service ✅
**Tool:** `vizora_service_start`

**Prerequisites:** Ensure middleware is NOT running

```bash
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "vizora_service_start",
    "arguments": {
      "service": "middleware"
    }
  }
}
```

**Expected Output:**
```
Service 'middleware' started successfully on port 3000
```

**Success Criteria:**
- ✅ Service starts within 3-5 seconds
- ✅ Port 3000 becomes occupied
- ✅ Process visible in Task Manager
- ✅ Can access http://localhost:3000

**Error Test:** Try starting when already running
```bash
# Should return: "Service 'middleware' is already running on port 3000"
```

---

## Test 4: Stop Service ✅
**Tool:** `vizora_service_stop`

**Prerequisites:** Ensure middleware IS running

```bash
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "vizora_service_stop",
    "arguments": {
      "service": "middleware"
    }
  }
}
```

**Expected Output:**
```
Service 'middleware' stopped (PID: 12345)
```

**Success Criteria:**
- ✅ Service stops immediately
- ✅ Port 3000 becomes available
- ✅ Process no longer in Task Manager
- ✅ http://localhost:3000 unreachable

**Error Test:** Try stopping when already stopped
```bash
# Should return: "Service 'middleware' is not running"
```

---

## Test 5: Restart Service ✅
**Tool:** `vizora_service_restart`

```bash
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "vizora_service_restart",
    "arguments": {
      "service": "web"
    }
  }
}
```

**Expected Output:**
```
Service 'web' stopped (PID: 12346)
Service 'web' started successfully on port 3001
```

**Success Criteria:**
- ✅ Old process killed
- ✅ New process started
- ✅ PID changes
- ✅ Service remains accessible
- ✅ Total time < 10 seconds

---

## Test 6: Kill Port ✅
**Tool:** `vizora_port_kill`

**Prerequisites:** Something running on port 3000

```bash
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "vizora_port_kill",
    "arguments": {
      "port": 3000
    }
  }
}
```

**Expected Output:**
```
Killed process 12345 on port 3000
```

**Success Criteria:**
- ✅ Process killed successfully
- ✅ Port becomes available
- ✅ Works on any port, not just Vizora services

**Error Test:** Try killing empty port
```bash
# Should return: "No process found on port 9999"
```

---

## Test 7: Service Logs (Placeholder) ⚠️
**Tool:** `vizora_service_logs`

```bash
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "vizora_service_logs",
    "arguments": {
      "service": "middleware",
      "lines": 50
    }
  }
}
```

**Expected Output:**
```
Logs for 'middleware' (last 50 lines):

[Log tailing not yet implemented - would require proper logging infrastructure]
```

**Success Criteria:**
- ✅ Returns placeholder message
- ✅ No errors
- ⚠️ Feature not fully implemented (future enhancement)

---

## Error Handling Tests

### Invalid Service Name
```bash
{
  "arguments": { "service": "invalid" }
}
```
**Expected:** Error message with valid service names

### Invalid Port
```bash
{
  "arguments": { "port": "not-a-number" }
}
```
**Expected:** Error message about port type

### Permission Denied
```bash
# Try killing a system process
{
  "arguments": { "port": 80 } // If IIS is running
}
```
**Expected:** Error message or "Failed to kill process"

---

## Integration Test Scenarios

### Scenario 1: Fresh Start
1. Kill all Vizora services manually
2. Check status → all stopped
3. Start middleware → success
4. Start web → success
5. Start realtime → success
6. Check status → all running

### Scenario 2: Recovery from Crash
1. Kill middleware process forcefully (Task Manager)
2. Check status → middleware stopped (orphaned port)
3. Kill port 3000 → success
4. Start middleware → success

### Scenario 3: Full Restart
1. Get status → note PIDs
2. Restart all services
3. Verify new PIDs
4. Verify all accessible

---

## Performance Benchmarks

| Operation | Target | Actual | Pass/Fail |
|-----------|--------|--------|-----------|
| Service Status | < 1s | ? | ? |
| Port Check (4 ports) | < 500ms | ? | ? |
| Start Service | < 5s | ? | ? |
| Stop Service | < 2s | ? | ? |
| Restart Service | < 10s | ? | ? |
| Kill Port | < 1s | ? | ? |

---

## Known Limitations

1. **Service Start:** Uses fire-and-forget `exec()`, process may not persist
2. **Logs:** Placeholder only, needs real implementation
3. **Windows Only:** Uses `netstat` and `taskkill`
4. **No Dependencies:** Doesn't check if PostgreSQL is running before starting middleware
5. **No Health Checks:** Doesn't verify service is actually responding

---

## Next Steps After Manual Testing

1. Document results in this file
2. Fix any bugs found
3. Add automated tests
4. Integrate with Clawdbot
5. Test with real AI assistant
6. Deploy to production

---

**Last Updated:** 2026-01-28 01:18 AM  
**Status:** Ready for manual testing
