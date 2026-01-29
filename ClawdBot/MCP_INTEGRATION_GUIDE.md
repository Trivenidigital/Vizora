# MCP Servers - Clawdbot Integration Guide

**Date:** 2026-01-28  
**Status:** All 5 servers BUILT, awaiting Clawdbot integration

---

## ✅ Completed Servers

All 5 MCP servers have been built and are ready for integration:

1. **vizora-service-manager** - Start/stop/restart services
2. **vizora-database** - Query database via Prisma
3. **vizora-test-runner** - Run tests & coverage
4. **vizora-git** - Git operations
5. **vizora-monitoring** - System health & metrics

---

## 🚀 Integration Steps

### Step 1: Verify MCP Server Builds

All servers should be built. Verify:

```bash
cd C:\Projects\vizora\vizora\mcp-servers

# Check each server has dist/index.js
dir vizora-service-manager\dist\index.js
dir vizora-database\dist\index.js
dir vizora-test-runner\dist\index.js
dir vizora-git\dist\index.js
dir vizora-monitoring\dist\index.js
```

### Step 2: Add to Clawdbot Config

Clawdbot's config schema doesn't expose an `mcp` field directly through config.patch. The MCP servers need to be configured through Clawdbot's native extension mechanism.

**Option A: Skills/Extensions** (Recommended for Clawdbot)
Convert MCP servers to Clawdbot skills or register them as external tools.

**Option B: Direct SDK Integration**
If Clawdbot supports MCP SDK client natively, configure via:
```json
{
  "tools": {
    "mcp": {
      "servers": {
        "vizora-database": {
          "command": "node",
          "args": ["C:/Projects/vizora/vizora/mcp-servers/vizora-database/dist/index.js"],
          "env": {
            "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/vizora?schema=public"
          }
        }
        // ... other servers
      }
    }
  }
}
```

### Step 3: Restart Clawdbot

```bash
clawdbot gateway restart
```

### Step 4: Test Integration

Test each MCP server:

```
# In chat with Clawdbot:
"Check Vizora service status"
"Query the Playlist table in the database"
"Run the middleware tests"
"Show git status"
"Check system resources"
```

---

## 📝 Alternative: Manual CLI Usage

Until Clawdbot integration is configured, you can test MCP servers manually:

### Service Manager
```bash
cd C:\Projects\vizora\vizora\mcp-servers\vizora-service-manager
node dist/index.js
```

Then send MCP requests via stdin (JSON-RPC format).

---

## 🔍 Next Steps

1. **Research Clawdbot MCP Support**: Check Clawdbot docs for native MCP SDK client support
2. **Skill Conversion**: If no native MCP support, convert servers to Clawdbot skills
3. **Direct Tool Registration**: Register MCP servers as external executable tools
4. **Configuration**: Update Clawdbot config with proper MCP server entries

---

## 📚 Resources

- **MCP Servers Location**: `C:\Projects\vizora\vizora\mcp-servers\`
- **Documentation**: Each server has a README.md with usage examples
- **Build Output**: `dist/index.js` in each server directory
- **Clawdbot Config**: `C:\Users\srila\.clawdbot\clawdbot.json`

---

**Status**: Ready for integration once Clawdbot MCP configuration method is confirmed.

Human action required: Determine how Clawdbot loads/connects to MCP servers.
