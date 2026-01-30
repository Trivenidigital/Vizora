# MCP (Model Context Protocol) for Vizora Development

## What is MCP?

**MCP (Model Context Protocol)** is a standardized way for AI assistants to connect to external tools and data sources. Think of it as "APIs for AI agents."

**Key Benefits:**
- 🔧 **Tool Access** - AI can use real development tools (Git, databases, APIs)
- 📊 **Live Data** - Access to project state, metrics, logs in real-time
- 🤖 **Automation** - AI can execute actions, not just suggest them
- 🔒 **Secure** - Controlled access with proper permissions

---

## Why MCP for Vizora?

### Problems We Experienced Today:
1. **No visibility into running services** - Had to manually check ports
2. **No direct database access** - Couldn't verify data state
3. **Manual service restarts** - Had to run commands manually
4. **Lost context** - AI couldn't see actual system state

### How MCP Solves This:

```
┌─────────────────────────────────────────────────────────┐
│                    AI Assistant (Me)                     │
└─────────────────────────────────────────────────────────┘
                            │
                            │ MCP Protocol
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   MCP Server (Local)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tool 1: Service Manager                        │   │
│  │  - Check service status                         │   │
│  │  - Start/stop/restart services                  │   │
│  │  - View logs                                    │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tool 2: Database Inspector                     │   │
│  │  - Query Prisma database                        │   │
│  │  - View table data                              │   │
│  │  - Run migrations                               │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tool 3: Git Operations                         │   │
│  │  - Branch management                            │   │
│  │  - Commit changes                               │   │
│  │  - View diffs                                   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tool 4: Test Runner                            │   │
│  │  - Run test suites                              │   │
│  │  - Get coverage reports                         │   │
│  │  - View test results                            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Vizora Project (File System)                │
└─────────────────────────────────────────────────────────┘
```

---

## Proposed MCP Servers for Vizora

### 1. **Vizora Service Manager MCP**
Controls and monitors all Vizora services.

**Tools:**
- `vizora.service.status` - Get status of all services
- `vizora.service.start` - Start a specific service
- `vizora.service.stop` - Stop a specific service
- `vizora.service.restart` - Restart a service
- `vizora.service.logs` - Get recent logs from a service
- `vizora.port.check` - Verify port availability
- `vizora.port.kill` - Kill process using a port

**Example Usage:**
```json
{
  "tool": "vizora.service.status",
  "response": {
    "middleware": { "status": "running", "port": 3000, "pid": 12345 },
    "web": { "status": "running", "port": 3001, "pid": 12346 },
    "realtime": { "status": "stopped", "port": null, "pid": null }
  }
}
```

### 2. **Vizora Database MCP**
Direct access to PostgreSQL via Prisma.

**Tools:**
- `vizora.db.query` - Execute safe read-only queries
- `vizora.db.inspect` - Get table structure
- `vizora.db.seed` - Seed test data
- `vizora.db.reset` - Reset database (with confirmation)
- `vizora.db.migrate` - Run pending migrations

**Example Usage:**
```json
{
  "tool": "vizora.db.query",
  "params": {
    "model": "Playlist",
    "where": { "id": "cmkxkfp2l0005f2pu7kaqd5j1" }
  },
  "response": {
    "id": "cmkxkfp2l0005f2pu7kaqd5j1",
    "name": "Test Playlist",
    "organizationId": "8fceb3f9-a1df-49ca-9704-6b9a4e953246"
  }
}
```

### 3. **Vizora Testing MCP**
Run and monitor tests.

**Tools:**
- `vizora.test.run` - Run specific test suite
- `vizora.test.coverage` - Get coverage report
- `vizora.test.watch` - Watch mode for TDD
- `vizora.test.e2e` - Run end-to-end tests

### 4. **Vizora Git MCP**
Version control operations.

**Tools:**
- `vizora.git.status` - Get current branch and changes
- `vizora.git.branch` - Create/switch branches
- `vizora.git.commit` - Commit changes
- `vizora.git.diff` - View changes

### 5. **Vizora Monitoring MCP**
Real-time metrics and health checks.

**Tools:**
- `vizora.metrics.api` - Get API response times
- `vizora.metrics.websocket` - Get WebSocket connection stats
- `vizora.health.check` - Run health checks on all services
- `vizora.logs.tail` - Tail logs from all services

---

## Implementation Plan

### Phase 1: Basic Service Management (2-3 hours)

**Create:** `mcp-servers/vizora-service-manager/`

```typescript
// mcp-servers/vizora-service-manager/src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "vizora-service-manager",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool: Check service status
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "vizora_service_status",
        description: "Get status of all Vizora services",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_service_restart",
        description: "Restart a Vizora service",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["middleware", "web", "realtime"],
              description: "Service to restart",
            },
          },
          required: ["service"],
        },
      },
      {
        name: "vizora_port_check",
        description: "Check if ports 3000-3002 are available",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Implement tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "vizora_service_status") {
    const ports = [3000, 3001, 3002];
    const status = {};
    
    for (const port of ports) {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      status[`port_${port}`] = stdout.trim() ? "occupied" : "free";
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }
  
  // ... more tool implementations
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Configure in Clawdbot:**
```json
// In Clawdbot config
{
  "mcpServers": {
    "vizora-service-manager": {
      "command": "node",
      "args": ["C:/Projects/vizora/mcp-servers/vizora-service-manager/dist/index.js"]
    }
  }
}
```

### Phase 2: Database Access (2-3 hours)

```typescript
// mcp-servers/vizora-database/src/index.ts
import { PrismaClient } from '@vizora/database';

const prisma = new PrismaClient();

// Tools:
// - vizora_db_query_playlist
// - vizora_db_query_display
// - vizora_db_query_content
// - vizora_db_inspect_schema
```

### Phase 3: Full Integration (4-6 hours)

Add all remaining MCP servers and integrate with development workflow.

---

## Real-World Example: How MCP Would Have Helped Today

### Today's Debugging Session (Without MCP):

```
USER: "Playlist assignment fails with 404"

AI: "Let me check... can you run this command?"
USER: [runs PowerShell command]
USER: [pastes output]

AI: "Now check the database..."
USER: [writes node script]
USER: [runs script]
USER: [pastes output]

AI: "Hmm, can you check if the service is running?"
USER: [checks netstat]
USER: [pastes output]

[30 minutes of back-and-forth]
```

### With MCP (Future):

```
USER: "Playlist assignment fails with 404"

AI: "Let me investigate..."
[AI calls vizora.service.status]
[AI calls vizora.db.query for playlist]
[AI calls vizora.db.query for display]
[AI calls vizora.logs.tail for recent errors]

AI: "Found it! The issue is..."
[AI calls vizora.db.query to verify fix]

AI: "Fixed! Here's what I changed:"
[1 minute total]
```

**Time saved:** 29 minutes  
**Errors avoided:** Multiple trial-and-error cycles  
**Confidence:** AI can verify fixes immediately

---

## MCP Benefits for Vizora Development

### 1. **Autonomous Debugging**
AI can:
- Check service health
- Query database state
- View logs
- Verify fixes

**Without human intervention!**

### 2. **Faster Development Cycles**
```
Traditional: Write code → Ask user to test → Get feedback → Repeat
With MCP:    Write code → Test automatically → Fix → Done
```

### 3. **Better Code Quality**
AI can:
- Run tests after every change
- Verify database migrations
- Check for regressions
- Enforce coding standards

### 4. **Reduced Context Switching**
You don't need to:
- Switch between terminals
- Copy-paste command outputs  
- Manually restart services
- Check logs in multiple places

AI handles all of it.

### 5. **Learning & Improvement**
MCP servers can:
- Log common issues
- Track fix patterns
- Build knowledge base
- Suggest preventive measures

---

## Next Steps

### Immediate (This Week)
1. ✅ Document MCP strategy (this file)
2. Create simple service manager MCP
3. Test with basic operations (status, restart)

### Short-term (Next Week)
4. Add database query MCP
5. Add test runner MCP
6. Integrate with Clawdbot config

### Long-term (Next Month)
7. Add monitoring MCP
8. Add git operations MCP
9. Create custom Vizora CLI using MCP
10. Document best practices

---

## Resources

### MCP Documentation
- Official Docs: https://modelcontextprotocol.io
- SDK: https://github.com/modelcontextprotocol/sdk
- Examples: https://github.com/modelcontextprotocol/servers

### Example MCP Servers
- **Filesystem MCP** - File operations
- **PostgreSQL MCP** - Database access
- **Git MCP** - Version control
- **Docker MCP** - Container management

### For Vizora
- We can build on existing servers
- Customize for our specific needs
- Add Vizora-specific business logic

---

## Conclusion

**MCP is EXACTLY what we need for Vizora development.**

Instead of:
- ❌ Manual service management
- ❌ Copy-paste commands
- ❌ Back-and-forth debugging
- ❌ Lost context

We get:
- ✅ Autonomous AI debugging
- ✅ Real-time system access
- ✅ Faster development cycles
- ✅ Better code quality

**Recommendation:** Start with a simple service manager MCP this week. Once proven, expand to database, testing, and monitoring.

**Estimated ROI:** 
- Development time: 8-10 hours
- Time saved per debugging session: 20-30 minutes
- Break-even: After ~25 debugging sessions (probably next week!)
