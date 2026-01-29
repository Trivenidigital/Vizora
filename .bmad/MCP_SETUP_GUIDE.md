# 🤖 MCP Servers Setup Guide

**Purpose:** Set up and use Vizora's 5 MCP servers for automated testing  
**Time Required:** 10-15 minutes  
**Benefit:** Save 30+ minutes per testing session!

---

## What Are MCP Servers?

**MCP (Model Context Protocol)** servers are tools that give AI assistants (like me!) programmatic access to your application.

**Vizora has 5 custom MCP servers:**
1. **service-manager** - Start/stop services
2. **test-runner** - Run automated tests
3. **database** - Query database directly
4. **monitoring** - Check health & metrics
5. **git** - Version control operations

---

## Quick Setup (5 minutes)

### Step 1: Build All MCP Servers

```powershell
cd C:\Projects\vizora\vizora\mcp-servers

# Build each server
cd vizora-service-manager
npm install
npm run build
cd ..

cd vizora-test-runner
npm install
npm run build
cd ..

cd vizora-database
npm install
npm run build
cd ..

cd vizora-monitoring
npm install  
npm run build
cd ..

cd vizora-git
npm install
npm run build
cd ..
```

**Expected:** Each should create a `dist/index.js` file

---

### Step 2: Verify MCP Servers Built

```powershell
# Check all servers built successfully
Get-ChildItem C:\Projects\vizora\vizora\mcp-servers\*/dist/index.js

# Should show 5 files
```

---

### Step 3: Configure in Clawdbot (If Using)

If using Clawdbot, add to your gateway config:

```yaml
mcpServers:
  vizora-service-manager:
    command: node
    args:
      - C:\Projects\vizora\vizora\mcp-servers\vizora-service-manager\dist\index.js
    
  vizora-test-runner:
    command: node
    args:
      - C:\Projects\vizora\vizora\mcp-servers\vizora-test-runner\dist\index.js
      
  vizora-database:
    command: node
    args:
      - C:\Projects\vizora\vizora\mcp-servers\vizora-database\dist\index.js
      
  vizora-monitoring:
    command: node
    args:
      - C:\Projects\vizora\vizora\mcp-servers\vizora-monitoring\dist\index.js
      
  vizora-git:
    command: node
    args:
      - C:\Projects\vizora\vizora\mcp-servers\vizora-git\dist\index.js
```

---

## Tool Reference

### vizora-service-manager

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `service_status` | (none) | Check all services |
| `service_start` | `service`: "middleware"\|"web"\|"realtime"\|"all" | Start service(s) |
| `service_stop` | `service`: name | Stop service |
| `service_restart` | `service`: name | Restart service |
| `service_logs` | `service`: name, `lines`: number | Get logs |

**Example Usage:**
```javascript
// Start all services
await use_mcp_tool({
  server: "vizora-service-manager",
  tool: "service_start",
  arguments: { service: "all" }
});

// Check status
await use_mcp_tool({
  server: "vizora-service-manager",
  tool: "service_status"
});
```

---

### vizora-test-runner

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `run_tests` | `project`: string, `coverage`: bool | Run project tests |
| `run_all_tests` | `coverage`: bool | Run all tests |
| `run_e2e_tests` | `project`: string | Run E2E tests |
| `get_test_results` | (none) | Latest test results |
| `get_test_coverage` | (none) | Coverage report |

**Example Usage:**
```javascript
// Run middleware tests
await use_mcp_tool({
  server: "vizora-test-runner",
  tool: "run_tests",
  arguments: { project: "middleware", coverage: true }
});
```

---

### vizora-database

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `query_model` | `model`: string, `filters`: object | Query Prisma model |
| `get_by_id` | `model`: string, `id`: string | Get by ID |
| `get_schema` | `model`: string | View schema |
| `count_records` | `model`: string, `filters`: object | Count records |

**Available Models:**
- User
- Organization  
- Display
- Content
- Playlist
- PlaylistItem
- Schedule

**Example Usage:**
```javascript
// Query all displays for an organization
await use_mcp_tool({
  server: "vizora-database",
  tool: "query_model",
  arguments: {
    model: "Display",
    filters: { organizationId: "org123" }
  }
});

// Get specific user
await use_mcp_tool({
  server: "vizora-database",
  tool: "get_by_id",
  arguments: {
    model: "User",
    id: "user456"
  }
});
```

---

### vizora-monitoring

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `get_health_status` | (none) | Check API health |
| `get_metrics` | (none) | Prometheus metrics |
| `check_endpoints` | (none) | Ping all endpoints |
| `get_error_logs` | `limit`: number | Recent errors |

**Example Usage:**
```javascript
// Health check all services
await use_mcp_tool({
  server: "vizora-monitoring",
  tool: "get_health_status"
});

// Get error logs
await use_mcp_tool({
  server: "vizora-monitoring",
  tool: "get_error_logs",
  arguments: { limit: 50 }
});
```

---

### vizora-git

| Tool | Arguments | Purpose |
|------|-----------|---------|
| `git_status` | (none) | Git status |
| `git_diff` | `file`: string | View changes |
| `git_commit` | `message`: string, `files`: array | Commit |
| `git_log` | `limit`: number | Commit history |

**Example Usage:**
```javascript
// Commit test results
await use_mcp_tool({
  server: "vizora-git",
  tool: "git_commit",
  arguments: {
    message: "test: Story-001 test results",
    files: [".bmad/testing/test-cases/story-001-tests.md"]
  }
});
```

---

## Testing Workflow with MCP

### 1. Start Testing Session

```javascript
// Check services
const status = await service_status();

// Start if needed
if (!status.all_running) {
  await service_start({ service: "all" });
  // Wait 30 seconds for boot
  await service_status(); // Verify
}

// Health check
await get_health_status();
```

### 2. Execute Test Case

```
Manual: User performs action in UI
```

### 3. Verify with MCP

```javascript
// Check database
const users = await query_model({
  model: "User",
  filters: { email: "test@example.com" }
});

// Verify created
console.log(users); // Should have 1 result
```

### 4. Debug if Failed

```javascript
// Get logs
const logs = await service_logs({
  service: "middleware",
  lines: 50
});

// Check errors
const errors = await get_error_logs({ limit: 10 });
```

---

## Common MCP Patterns

### Pattern 1: Data Verification
```javascript
// After any create operation
const records = await query_model({
  model: "ModelName",
  filters: { /* your filters */ }
});

if (records.length === 0) {
  console.log("❌ Record not created!");
} else {
  console.log("✅ Record created:", records[0]);
}
```

### Pattern 2: Multi-Tenant Check
```javascript
// Verify isolation
const orgA = await query_model({
  model: "Display",
  filters: { organizationId: "org-a" }
});

const orgB = await query_model({
  model: "Display",
  filters: { organizationId: "org-b" }
});

// Check no overlap
const overlap = orgA.some(a => 
  orgB.some(b => b.id === a.id)
);

console.log(overlap ? "❌ ISOLATION BREACH!" : "✅ Isolated");
```

### Pattern 3: Performance Monitoring
```javascript
// Before test
const metricsBefore = await get_metrics();

// Run test...

// After test
const metricsAfter = await get_metrics();

// Compare response times
```

---

## Troubleshooting

### MCP Server Won't Start

**Problem:** `Error: Cannot find module`  
**Solution:**
```powershell
cd C:\Projects\vizora\vizora\mcp-servers\<server-name>
npm install
npm run build
```

### Database Queries Failing

**Problem:** `Prisma Client not generated`  
**Solution:**
```powershell
cd C:\Projects\vizora\vizora\mcp-servers\vizora-database
npx prisma generate
npm run build
```

### Service Manager Can't Start Services

**Problem:** Commands failing  
**Solution:** Check paths in `src/index.ts` match your project structure

---

## Benefits Recap

**Without MCP:**
- Manual service starts (3 terminals)
- Can't see database state
- Manual log hunting
- Tedious verification

**With MCP:**
- ✅ One-command service start
- ✅ Direct database queries
- ✅ Instant log access
- ✅ Automated verification
- ✅ Faster debugging
- ✅ Better test reports

**Time Saved:** ~30 minutes per testing session!

---

## Ready to Use!

Once MCP servers are built, you can use them during testing to:
- Start services automatically
- Verify database state
- Run automated tests
- Monitor performance
- Debug issues faster

**MCP servers turn manual testing into semi-automated testing!** 🚀

---

**Next:** See `.bmad/READY_FOR_TESTING.md` for full testing workflow with MCP examples!
