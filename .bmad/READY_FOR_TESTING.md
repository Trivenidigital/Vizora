# ✅ READY FOR TESTING - Leveraging MCP Servers!

**Date:** 2026-01-28 22:00:00  
**Status:** BMAD Structure Complete - Ready to Execute with MCP Automation  
**Baseline Commit:** `8142493bb25d86a6c3bcbf9304c39712d481de18`

---

## 🎉 What Was Accomplished

### ✅ BMAD Infrastructure (100% Complete)
- Sprint tracker with all 27 stories
- 27 story files with acceptance criteria
- 27 test case files with 200 test cases
- Evidence capture system
- Bug tracking system
- Test report templates

### ✅ MCP Servers Available (5 Configured!)
Vizora has **5 custom MCP servers** built specifically for testing automation!

---

## 🤖 MCP Servers for Testing

### 1. **vizora-service-manager** ⭐
**Purpose:** Start/stop/monitor Vizora services

**Tools Available:**
- `service_status` - Check status of all services (middleware, web, realtime)
- `service_start` - Start a specific service or all services
- `service_stop` - Stop a specific service  
- `service_restart` - Restart a service
- `service_logs` - Get service logs (last N lines)

**Use for:**
- Starting services before testing
- Checking if services are running
- Getting logs when tests fail
- Stopping/restarting services between test runs

---

### 2. **vizora-test-runner** 🧪
**Purpose:** Run automated tests via Nx

**Tools Available:**
- `run_tests` - Run tests for specific project (middleware, web, etc.)
- `run_all_tests` - Run entire test suite
- `run_e2e_tests` - Run end-to-end tests
- `get_test_results` - Get latest test results
- `get_test_coverage` - Get code coverage report

**Use for:**
- Running automated tests alongside manual testing
- Verifying backend functionality
- Getting test coverage metrics
- Smoke testing before manual QA

---

### 3. **vizora-database** 💾
**Purpose:** Query and inspect database directly

**Tools Available:**
- `query_model` - Query Prisma models (User, Organization, Display, Content, Playlist, etc.)
- `get_by_id` - Get specific record by ID
- `get_schema` - View database schema
- `count_records` - Count records in a table
- `execute_raw_query` - Execute raw SQL (read-only)

**Use for:**
- Verifying data created during tests
- Checking multi-tenant isolation (query by organizationId)
- Debugging failed test cases
- Confirming database state

---

### 4. **vizora-monitoring** 📊
**Purpose:** Monitor application metrics and health

**Tools Available:**
- `get_health_status` - Check API health endpoints
- `get_metrics` - Get Prometheus metrics
- `check_endpoints` - Ping all critical endpoints
- `get_error_logs` - Get recent error logs from Sentry

**Use for:**
- Verifying services are healthy
- Monitoring performance during testing
- Detecting errors in real-time
- Getting metrics for test reports

---

### 5. **vizora-git** 📝
**Purpose:** Git operations for version control

**Tools Available:**
- `git_status` - Check git status
- `git_diff` - View changes
- `git_commit` - Commit changes
- `git_log` - View commit history

**Use for:**
- Committing test results
- Creating bug report branches
- Tracking changes during testing
- Version control of test artifacts

---

## 🚀 Enhanced Testing Workflow with MCP

### Step 1: Environment Setup (5 min) - **USE MCP!**

Instead of manually starting services:

```
Using MCP vizora-service-manager:
1. service_status - Check current status
2. service_start service="all" - Start all services at once
3. service_status - Verify all running
```

**Benefit:** One command to start everything! No multiple terminals!

---

### Step 2: Pre-Test Verification (2 min) - **USE MCP!**

```
Using MCP vizora-monitoring:
1. get_health_status - Verify API responding
2. check_endpoints - Confirm all endpoints alive

Using MCP vizora-database:
3. count_records model="Organization" - Verify DB accessible
```

**Benefit:** Automated health check before testing!

---

### Step 3: Execute Manual Tests (varies)

Follow test cases in `.bmad/testing/test-cases/story-*.md`

**But leverage MCP during testing:**

#### During Authentication Tests (Story-001):
```
After creating user via UI:

Using MCP vizora-database:
- query_model model="User" filters={"email": "test@example.com"}
- Verify user created in database
- Check organizationId field populated
```

#### During Device Tests (Story-004):
```
After pairing device:

Using MCP vizora-database:
- query_model model="Display" filters={"status": "online"}
- Verify device record created
- Check pairing_code cleared

Using MCP vizora-monitoring:
- get_metrics - Check device connection metrics
```

#### During Content Tests (Story-007):
```
After uploading content:

Using MCP vizora-database:
- query_model model="Content" filters={"type": "image"}
- Verify thumbnail path exists
- Check file size recorded

Using MCP filesystem (if available):
- Check file actually saved to static/uploads/
```

---

### Step 4: Automated Test Integration - **USE MCP!**

Run automated tests alongside manual testing:

```
Using MCP vizora-test-runner:
1. run_tests project="middleware" - Run backend unit tests
2. run_e2e_tests project="middleware-e2e" - Run API tests
3. get_test_results - Check pass/fail rates
4. get_test_coverage - Get code coverage
```

**Benefit:** Combine manual UI testing with automated backend testing!

---

### Step 5: Bug Investigation - **USE MCP!**

When you find a bug:

```
Using MCP vizora-service-manager:
1. service_logs service="middleware" lines=50 - Get recent logs

Using MCP vizora-database:
2. get_by_id model="Display" id="<device-id>" - Check device state
3. query_model model="Playlist" filters={"id": "<playlist-id>"} - Verify data

Using MCP vizora-monitoring:
4. get_error_logs - Check for exceptions
```

**Benefit:** Rapid debugging with direct data access!

---

### Step 6: Test Results & Reporting - **USE MCP!**

```
Using MCP vizora-test-runner:
1. get_test_coverage - Add to report
2. get_test_results - Include automated test stats

Using MCP vizora-database:
3. count_records model="User" - Report # users created
4. count_records model="Content" - Report # content items
5. count_records model="Playlist" - Report # playlists

Using MCP vizora-git:
6. git_commit - Commit test results
```

**Benefit:** Automated metrics collection for test reports!

---

## 📋 MCP-Enhanced Test Execution Checklist

### Pre-Testing (MCP Automated)
- [ ] `service_status` - Check services
- [ ] `service_start service="all"` - Start if needed
- [ ] `get_health_status` - Verify healthy
- [ ] `check_endpoints` - All APIs responding

### During Testing (Manual + MCP)
- [ ] Execute test cases manually (UI interaction)
- [ ] Use `query_model` to verify database state
- [ ] Use `service_logs` when issues occur
- [ ] Use `get_metrics` to monitor performance

### Post-Testing (MCP Automated)
- [ ] `run_all_tests` - Run automated suite
- [ ] `get_test_coverage` - Collect metrics
- [ ] `count_records` - Gather statistics
- [ ] `git_commit` - Save results

---

## 🎯 MCP Usage Examples by Story

### Story-001: Authentication

**Manual:** User registers via UI  
**MCP Verification:**
```
query_model model="User" filters={"email": "test@test.com"}
→ Verify user created

query_model model="Organization" 
→ Verify organization created

get_by_id model="User" id="<user-id>"
→ Confirm passwordHash exists (not plain text)
```

---

### Story-003: Multi-Tenant Isolation (SECURITY)

**Manual:** Create data in Org A, login as Org B  
**MCP Verification:**
```
query_model model="Display" filters={"organizationId": "<org-a-id>"}
→ Get Org A devices

query_model model="Display" filters={"organizationId": "<org-b-id>"}
→ Get Org B devices

→ Verify no overlap, complete isolation
```

---

### Story-018: Content Push

**Manual:** Push playlist to device via UI  
**MCP Verification:**
```
get_by_id model="Display" id="<device-id>"
→ Check currentPlaylistId updated

get_metrics
→ Verify WebSocket message sent

service_logs service="realtime" lines=20
→ Confirm push event logged
```

---

## 💡 Pro Tips for MCP Testing

### 1. **Start Services Smart**
Don't manually start 3 terminals. Use:
```
service_start service="all"
```
Wait 30 seconds, then:
```
service_status
```
All 3 services should show "running"!

### 2. **Database Verification is Key**
After EVERY create/update/delete action, verify in database:
```
query_model model="<ModelName>" filters={...}
```

### 3. **Monitor Logs in Real-Time**
Keep logs visible during testing:
```
service_logs service="middleware" lines=100
```
Refresh when tests fail to see errors!

### 4. **Combine Manual + Automated**
Run automated tests first:
```
run_tests project="middleware"
```
If 100% pass → proceed with manual UI testing  
If failures → fix before manual testing

### 5. **Use Database for Test Data Cleanup**
Before each test story:
```
query_model model="User"
query_model model="Display"
→ Note existing data

After tests:
→ Clean up test data (manual or via DB tool)
```

---

## 📊 Expected MCP Server Performance

### Service Manager
- **service_start:** ~30 seconds (services boot time)
- **service_status:** <1 second
- **service_logs:** <1 second

### Test Runner
- **run_tests:** 10-60 seconds (depends on project)
- **run_all_tests:** 2-5 minutes
- **get_test_results:** <1 second

### Database
- **query_model:** <500ms
- **get_by_id:** <100ms
- **count_records:** <200ms

### Monitoring
- **get_health_status:** <1 second
- **get_metrics:** <2 seconds
- **check_endpoints:** <3 seconds

---

## 🚀 Quick Start with MCP

### Step 1: Verify MCP Servers Built
```bash
cd C:\Projects\vizora\vizora\mcp-servers

# Build all MCP servers
cd vizora-service-manager && npm run build && cd ..
cd vizora-test-runner && npm run build && cd ..
cd vizora-database && npm run build && cd ..
cd vizora-monitoring && npm run build && cd ..
cd vizora-git && npm run build && cd ..
```

### Step 2: Start Services with MCP
Use the `service_start` tool to start all services

### Step 3: Begin Testing
Follow test plan with MCP verification at each step

---

## 📁 File Locations

### Testing Documents
- **This Guide:** `.bmad/READY_FOR_TESTING.md`
- **Test Plan:** `.bmad/testing/manual-test-plan.md`
- **Test Cases:** `.bmad/testing/test-cases/story-*.md`

### MCP Servers
- **Location:** `C:\Projects\vizora\vizora\mcp-servers\`
- **Built Files:** Each has `dist/index.js` after building

---

## ✅ Advantages of MCP-Enhanced Testing

| Task | Without MCP | With MCP | Time Saved |
|------|-------------|----------|------------|
| Start services | 3 terminals, manual | 1 command | 5 min |
| Verify data | Check UI only | Query DB directly | 2 min/test |
| Debug issue | Manual log files | `service_logs` | 3 min/bug |
| Run tests | Navigate, type commands | `run_all_tests` | 5 min |
| Get metrics | Manual collection | `get_metrics` | 10 min |
| **TOTAL** | - | - | **~30 min/session** |

---

## 🎊 You're Ready!

**With MCP servers, you have:**
- ✅ Automated service management
- ✅ Direct database access for verification
- ✅ Integrated test running
- ✅ Real-time monitoring
- ✅ Git automation

**This is professional-grade QA infrastructure!** 🚀

---

**What's next?**

**A** - Build MCP servers and start testing  
**B** - Review MCP tools first  
**C** - Start without MCP (manual only)  
**D** - Something else?
