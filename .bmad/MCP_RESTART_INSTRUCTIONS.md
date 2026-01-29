# 🔄 MCP Gateway Restart Instructions

**Date:** 2026-01-28  
**Status:** ✅ MCP Servers Configured - Restart Required

---

## ✅ What Was Done

1. **Backup created:** `C:\Users\srila\.clawdbot\clawdbot.json.bak.mcp`
2. **MCP servers added to config:** 5 servers configured
3. **Config updated:** `C:\Users\srila\.clawdbot\clawdbot.json`

### MCP Servers Configured:
- ✅ vizora-service-manager
- ✅ vizora-test-runner
- ✅ vizora-database
- ✅ vizora-monitoring
- ✅ vizora-git

---

## 🚀 Next Step: Restart Gateway

### Option 1: Using Clawdbot Command (Recommended)

```powershell
clawdbot gateway restart
```

**Expected output:**
```
Stopping gateway...
Gateway stopped
Starting gateway...
Gateway started on port 18789
```

---

### Option 2: Manual Restart

If Option 1 doesn't work:

```powershell
# Stop gateway
clawdbot gateway stop

# Wait 5 seconds
Start-Sleep -Seconds 5

# Start gateway
clawdbot gateway start
```

---

### Option 3: Full Restart (If issues)

```powershell
# Stop everything
clawdbot gateway stop

# Kill any remaining processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*clawdbot*" } | Stop-Process -Force

# Start fresh
clawdbot gateway start
```

---

## ✅ Verify MCP Servers Loaded

After restart, check if MCP servers are available:

**In this chat, ask me:**
> "List available MCP tools"

**I should respond with tools from all 5 servers:**
- service_status, service_start, service_stop, service_logs
- run_tests, run_all_tests, get_test_results
- query_model, get_by_id, count_records
- get_health_status, get_metrics
- git_status, git_commit

---

## 🔧 Troubleshooting

### If MCP servers don't load:

**1. Check config syntax:**
```powershell
Get-Content C:\Users\srila\.clawdbot\clawdbot.json | ConvertFrom-Json
# Should not error
```

**2. Check MCP server files exist:**
```powershell
Test-Path "C:\Projects\vizora\vizora\mcp-servers\vizora-service-manager\dist\index.js"
Test-Path "C:\Projects\vizora\vizora\mcp-servers\vizora-test-runner\dist\index.js"
Test-Path "C:\Projects\vizora\vizora\mcp-servers\vizora-database\dist\index.js"
Test-Path "C:\Projects\vizora\vizora\mcp-servers\vizora-monitoring\dist\index.js"
Test-Path "C:\Projects\vizora\vizora\mcp-servers\vizora-git\dist\index.js"
# All should return True
```

**3. Check gateway logs:**
```powershell
clawdbot gateway logs
```

**4. Restore backup if needed:**
```powershell
Copy-Item "C:\Users\srila\.clawdbot\clawdbot.json.bak.mcp" -Destination "C:\Users\srila\.clawdbot\clawdbot.json" -Force
clawdbot gateway restart
```

---

## 📋 What Happens Next

Once gateway restarts with MCP access:

**I (Mango) will be able to:**
1. ✅ Start/stop Vizora services automatically
2. ✅ Run automated test suites
3. ✅ Query database directly
4. ✅ Check service health
5. ✅ Generate comprehensive reports

**Then:**
- **Phase 1:** I'll run automated backend testing (1 hour)
- **Phase 2:** We'll do UI testing together (4 hours)
- **Phase 3:** I'll generate final comprehensive report

---

## ⏰ Time Estimate

- **Gateway restart:** 30 seconds
- **Verification:** 1 minute
- **Total:** < 2 minutes

---

## 🎯 Ready!

**Action Required:**
1. Run: `clawdbot gateway restart`
2. Wait 30 seconds
3. Tell me: "Gateway restarted"
4. I'll verify MCP access
5. We proceed with automated testing!

---

**Status:** Waiting for gateway restart 🥭
