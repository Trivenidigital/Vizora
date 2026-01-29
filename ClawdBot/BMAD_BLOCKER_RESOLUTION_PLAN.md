# BMAD Blocker Resolution Plan for Vizora
**Date:** January 28, 2026
**Status:** Ready to execute immediately
**Expected Timeline:** 1-2 hours for all 3 blockers

---

## Overview

Your Vizora project has 3 critical blockers. This document shows exactly how to use BMAD workflows to resolve them systematically.

**The 3 Blockers:**
1. ❌ Playlist assignment returns 404 (despite data existing)
2. ❌ Realtime service won't start on port 3002
3. ❌ Middleware stability issues

**BMAD Approach:** Each blocker gets the same structured workflow:
```
/quick-spec (understand) → /bmad-dev-story (fix) → /bmad-code-review (validate)
```

---

## Blocker #1: Playlist Assignment Returns 404

### Current Problem
- Users try to assign playlists to devices
- Returns 404 error
- Data exists in database
- Pairing seems to work
- API endpoint broken

### BMAD Resolution Workflow

#### Step 1: Analyze with `/quick-spec`

**Run this:**
```bash
/quick-spec "Playlist assignment returns 404 despite data existing in database. User clicks 'Assign Playlist' button but gets 404 error. Same playlist works in other contexts."
```

**What you'll get:**
- Root cause analysis
- Files that need investigation:
  - `middleware/src/modules/playlists/playlists.controller.ts` (likely)
  - `middleware/src/modules/displays/displays.controller.ts` (likely)
  - `packages/shared/types/` (DTOs)
  - `packages/database/prisma/schema.prisma` (DB schema)
- Specific lines to check
- Hypothesis of what's broken
- Test strategy to verify fix
- Implementation approach

**Key Questions It Will Answer:**
- Is it a routing issue?
- Is it a database query issue?
- Is it an authentication issue?
- Is it a data validation issue?

#### Step 2: Implement Fix with `/bmad-dev-story`

**After reviewing `/quick-spec` output, run:**
```bash
/bmad-dev-story
```

**What it will do:**
1. Confirm the fix scope
2. Create test file with failing tests (Red phase)
3. Implement the fix (Green phase)
4. Refactor if needed (Refactor phase)
5. Run tests to verify
6. Git commit with explanation

**Files that will be modified:**
- API endpoint handler (likely in `playlists.controller.ts`)
- Possibly DTOs if validation needed
- Test files (new or updated)
- Migration if database schema issue

**Example Implementation Path:**
```typescript
// Before
@Post(':id/assign-playlist')
async assignPlaylist(...) {
  // Current broken implementation
}

// After
@Post(':id/assign-playlist')
async assignPlaylist(...) {
  // Fixed implementation
  // - Proper validation
  // - Correct DB query
  // - Error handling
}
```

#### Step 3: Validate with `/bmad-code-review`

**When implementation complete:**
```bash
/bmad-code-review
```

**What it checks:**
- ✓ Specification matches: Does fix match `/quick-spec` analysis?
- ✓ Test coverage: Are all cases tested?
- ✓ No regressions: Did we break anything else?
- ✓ Code quality: Follows Vizora patterns?
- ✓ Documentation: Changes documented?
- ✓ Ready for production: Safe to merge?

**Result:** Git commit with comment explaining:
- What was wrong
- How it was fixed
- What tests validate it
- Performance impact (if any)

### Timeline for Blocker #1
```
/quick-spec:        5 minutes (reading analysis)
/bmad-dev-story:   10 minutes (implementation)
/bmad-code-review:  3 minutes (validation)
────────────────────
Total:             18 minutes
```

### Success Criteria
```
✅ /quick-spec identifies root cause
✅ /bmad-dev-story implements fix
✅ All tests pass (100% pass rate)
✅ /bmad-code-review validates
✅ Git commit created with explanation
✅ Playlist assignment now works
```

---

## Blocker #2: Realtime Service Won't Start on Port 3002

### Current Problem
- Realtime service should start on port 3002
- Currently not starting or uses wrong port
- Cannot connect WebSocket clients
- Services cannot communicate properly

### BMAD Resolution Workflow

#### Step 1: Analyze with `/quick-spec`

**Run this:**
```bash
/quick-spec "Realtime service (Socket.IO) won't start on port 3002. Service fails to start or uses port 3000 instead. Middleware already uses 3000. Need exclusive port 3002 for realtime."
```

**What you'll get:**
- Port configuration analysis
- Files to investigate:
  - `realtime/src/main.ts` (service entry point)
  - `.env` or `config.yml` (port configuration)
  - `docker-compose.yml` (if containerized)
  - `realtime/package.json` (scripts section)
  - Nginx or proxy config (if applicable)
- Root cause (port conflict, config issue, permission issue, etc.)
- How to verify fix works
- Impact on other services

**Key Questions It Will Answer:**
- Is port 3002 already in use?
- Is configuration wrong?
- Are permissions preventing port access?
- Is startup script correct?
- Are environment variables set?

#### Step 2: Implement Fix with `/bmad-dev-story`

**After understanding root cause:**
```bash
/bmad-dev-story
```

**What it will do:**
1. Create test case: "Service starts on port 3002"
2. Fix configuration/code (Red → Green → Refactor)
3. Verify service starts
4. Verify clients can connect
5. Git commit

**Possible Fixes:**
```bash
# If it's environment variable:
.env file:
  REALTIME_PORT=3002

# If it's config file:
realtime/src/main.ts:
  const port = process.env.REALTIME_PORT || 3002

# If it's port conflict:
  Kill process on 3002
  OR change middleware to 3000 (already is)
  OR proxy configuration

# If it's docker:
  docker-compose.yml:
    ports:
      - "3002:3002"  (was "3001:3002")
```

#### Step 3: Validate with `/bmad-code-review`

**When service starts correctly:**
```bash
/bmad-code-review
```

**What it checks:**
- ✓ Service actually starts on 3002
- ✓ Middleware still on 3000
- ✓ Web still on 3002 (or configured correctly)
- ✓ Display connects correctly
- ✓ No port conflicts
- ✓ Configuration documented

**Additional Validation:**
```bash
# Verify services work together:
1. Start middleware (port 3000)
2. Start realtime (port 3002)
3. Connect web dashboard
4. Connect TV client
5. All services respond on correct ports
```

### Timeline for Blocker #2
```
/quick-spec:        5 minutes (analysis)
/bmad-dev-story:    8 minutes (fix + verify)
/bmad-code-review:  3 minutes (validation)
Manual test:        5 minutes (verify services work)
────────────────────
Total:             21 minutes
```

### Success Criteria
```
✅ /quick-spec identifies port issue
✅ /bmad-dev-story fixes configuration
✅ Realtime service starts on port 3002
✅ Middleware still on port 3000
✅ Services communicate properly
✅ /bmad-code-review validates
✅ Git commit documents fix
```

---

## Blocker #3: Middleware Stability Issues

### Current Problem
- Middleware crashes or becomes unstable
- Services become unresponsive
- May be error handling issue
- May be memory leak
- May be unhandled exceptions

### BMAD Resolution Workflow

#### Step 1: Analyze with `/quick-spec`

**Run this:**
```bash
/quick-spec "Middleware becomes unstable after running for a while. Services become unresponsive. Possible causes: unhandled errors, memory leaks, connection pool exhaustion, or improper error handling in async operations."
```

**What you'll get:**
- Stability analysis
- Files to investigate:
  - `middleware/src/main.ts` (error handlers)
  - All service files (error handling patterns)
  - `middleware/src/common/filters/` (exception filters)
  - `middleware/src/common/middleware/` (middleware)
  - Database connection handling
  - WebSocket connection handling
- Error patterns to look for:
  - Unhandled promise rejections
  - Missing try-catch blocks
  - Unclosed connections
  - Memory leaks
- Test strategy to verify stability

**Key Questions It Will Answer:**
- What errors are being thrown?
- Are they being caught properly?
- Are connections being closed?
- Is memory being freed?
- Are timeouts configured?

#### Step 2: Implement Fix with `/bmad-dev-story`

**After understanding stability issues:**
```bash
/bmad-dev-story
```

**What it will do:**
1. Add global error handler if missing
2. Add error logging
3. Add connection timeouts
4. Add process health checks
5. Create tests for error scenarios
6. Verify stability under load
7. Git commit

**Possible Fixes:**
```typescript
// 1. Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 2. Async error handling
app.post('/api/endpoint', async (req, res) => {
  try {
    // implementation
  } catch (error) {
    next(error); // Pass to error handler
  }
});

// 3. Connection timeouts
const timeout = setTimeout(() => {
  // handle timeout
}, 30000);

// 4. Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 5. Graceful shutdown
process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});
```

#### Step 3: Validate with `/bmad-code-review`

**When stability improvements complete:**
```bash
/bmad-code-review
```

**What it checks:**
- ✓ All errors are caught and handled
- ✓ Connections are properly closed
- ✓ Memory is freed appropriately
- ✓ Timeouts are configured
- ✓ Health endpoints work
- ✓ Tests verify stability
- ✓ No unhandled rejections
- ✓ Graceful shutdown works

**Integration Testing:**
```bash
# Run /bmad-testarch-nfr for non-functional requirements:
1. Load test: 100 concurrent requests
2. Duration test: Service runs for 1 hour
3. Error injection: Verify error handling
4. Connection leak test: Verify no connection leaks
5. Memory test: Verify memory stays stable
```

### Timeline for Blocker #3
```
/quick-spec:        5 minutes (analysis)
/bmad-dev-story:   15 minutes (implement + test)
/bmad-code-review:  5 minutes (validation)
NFR testing:       10 minutes (stability verification)
────────────────────
Total:             35 minutes
```

### Success Criteria
```
✅ /quick-spec identifies stability issues
✅ /bmad-dev-story implements error handling
✅ All tests pass under load
✅ Service runs stably for 1+ hour
✅ Health endpoints responsive
✅ No unhandled errors in logs
✅ /bmad-code-review validates
✅ Git commit documents improvements
```

---

## Complete Blocker Resolution Plan

### Timeline Overview

```
START: 10:00 AM
├─ Blocker #1 (Playlist 404):    10:00 AM - 10:18 AM  (18 min)
├─ Blocker #2 (Port 3002):       10:18 AM - 10:39 AM  (21 min)
├─ Blocker #3 (Stability):       10:39 AM - 11:14 AM  (35 min)
└─ Final validation:             11:14 AM - 11:30 AM  (16 min)
END: 11:30 AM (Total: 90 minutes)
```

### Step-by-Step Execution

#### Phase 1: Playlist Assignment (First 18 minutes)

```bash
# Terminal 1: Analysis
/quick-spec "Playlist assignment returns 404 despite data existing in database"
# Read output, understand root cause (5 min)

# Terminal 1: Implementation
/bmad-dev-story
# Implement fix with tests (10 min)
# Watch tests pass

# Terminal 1: Validation
/bmad-code-review
# Review passes all quality gates (3 min)

# Result: Blocker #1 fixed, git commit created ✅
```

#### Phase 2: Realtime Service (Next 21 minutes)

```bash
# Terminal 1: Analysis
/quick-spec "Realtime service won't start on port 3002. Middleware uses 3000."
# Understand root cause (5 min)

# Terminal 1: Implementation
/bmad-dev-story
# Fix port configuration (8 min)

# Terminal 2: Manual Verification (while above runs)
# Start middleware on 3000
# Verify realtime starts on 3002 (5 min)

# Terminal 1: Validation
/bmad-code-review
# Confirm port fix validated (3 min)

# Result: Blocker #2 fixed, services communicate ✅
```

#### Phase 3: Middleware Stability (Next 35 minutes)

```bash
# Terminal 1: Analysis
/quick-spec "Middleware becomes unstable after running. Need better error handling."
# Understand what makes it unstable (5 min)

# Terminal 1: Implementation
/bmad-dev-story
# Implement error handling, timeouts, health checks (15 min)

# Terminal 2: Stability Testing (while above runs)
# Run load tests to verify stability (10 min)

# Terminal 1: Validation
/bmad-code-review
# Confirm stability improvements (5 min)

# Result: Blocker #3 fixed, stable service ✅
```

#### Phase 4: Final Integration (16 minutes)

```bash
# Terminal 1: Full System Test
1. Start all 4 services (display, middleware, realtime, web)
2. Test device pairing end-to-end
3. Verify playlist assignment works
4. Verify realtime socket communication
5. Verify services stay stable

# Terminal 1: Final Documentation
/bmad-document-project "Update docs with stability improvements"
# Create/update documentation

# Result: All blockers resolved, system stable, documented ✅
```

---

## BMAD Workflow Command Reference

### Quick Command Reference for Blockers

```bash
# For any blocker:
/quick-spec "[describe the blocker]"          # Analyze
/bmad-dev-story                               # Implement
/bmad-code-review                             # Validate

# For stability/performance:
/bmad-testarch-nfr "Middleware stability"     # NFR testing
/bmad-testarch-atdd "Device pairing flow"     # End-to-end

# For integration:
/bmad-testarch-ci "All services start"        # CI validation

# If you get stuck:
/bmad-help "What do I do next?"               # Get unstuck
```

---

## Quality Gates Before Merge

All 3 blockers must pass:

```
✅ Specification matches (/quick-spec identifies the problem correctly)
✅ Tests pass (100% pass rate)
✅ No regressions (existing tests still pass)
✅ Code review passes (/bmad-code-review validates)
✅ Documentation updated
✅ Git commits explain the fix
✅ Changes are verifiable
```

---

## Success Indicators

After completing all 3 blockers:

```
□ Playlist assignment works (no more 404)
□ Realtime service runs on port 3002
□ Middleware stays stable under load
□ All tests passing (100%)
□ Services communicate properly
□ Documentation updated
□ Git history shows clear fixes
□ No urgent blockers remaining
```

---

## What Comes After Blockers Are Fixed

Once all 3 blockers resolved:

```
Next Phase: Feature Development
1. /bmad-create-product-brief "Next feature"
2. /bmad-create-architecture "Design approach"
3. /bmad-create-epics-and-stories "Break into tasks"
4. /bmad-dev-story # For each story
5. /bmad-code-review # For each story

→ Ready for production deployment
```

---

## Important Reminders

### 1. Don't Skip Workflows
```
WRONG: Skip /quick-spec, jump to coding ✗
RIGHT: Always start with /quick-spec ✓
```

### 2. Tests Are Mandatory
```
WRONG: "I'll skip the test file" ✗
RIGHT: Tests created and run for every fix ✓
```

### 3. Code Review is Non-Negotiable
```
WRONG: "Code looks good, merge it" ✗
RIGHT: Always run /bmad-code-review ✓
```

### 4. Document Changes
```
WRONG: Changes with no explanation ✗
RIGHT: Git commits explain the why ✓
```

---

## You're Ready

All the tools you need:
- ✅ BMAD installed and verified
- ✅ Workflows understood
- ✅ 3 blockers clearly identified
- ✅ Timeline realistic and achievable
- ✅ Quality gates clear

**Next Step:** Pick Blocker #1 and run:
```bash
/quick-spec "Playlist assignment returns 404 despite data existing"
```

Then follow the output. You'll be amazed how clear the path becomes.

---

**Let's fix these blockers with confidence!** 🚀

