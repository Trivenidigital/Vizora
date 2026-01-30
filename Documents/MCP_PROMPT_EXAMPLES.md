# 🎯 MCP Prompt Examples - Copy & Paste Ready

These are ready-to-use prompts that leverage your MCP servers. Just copy them and adapt to your needs.

---

## 🧪 TEST RUNNER MCP Examples

### Example 1: Quick Test
```
Use Test Runner MCP to run all tests in the middleware module.
Show me the coverage report.
```

### Example 2: Specific Test File
```
Use Test Runner MCP to run tests for:
middleware/src/modules/auth/auth.service.spec.ts

If any tests fail, explain the failure and suggest fixes.
```

### Example 3: E2E Testing
```
Use Test Runner MCP to run all E2E tests.
Report on pass/fail status.
If any fail, show the error details.
```

### Example 4: Coverage Analysis
```
Use Test Runner MCP to generate a coverage report for the content module.
Show which functions lack test coverage.
Suggest which tests should be added.
```

### Example 5: After Code Changes
```
I've modified the password hashing in auth.service.ts.
Please use Test Runner MCP to:
1. Run all auth tests
2. Show coverage for the auth module
3. Confirm the changes don't break existing functionality
```

### Example 6: TDD Workflow
```
Use Test Runner MCP in watch mode for the auth tests.
I'm about to refactor the authentication service.
Run the tests continuously and let me know immediately if anything breaks.
```

---

## 🗄️ DATABASE INSPECTOR MCP Examples

### Example 1: Inspect Table Structure
```
Use Database Inspector MCP to show me the structure of:
1. users table
2. organizations table
3. content table

Include column names, types, and constraints.
```

### Example 2: Verify Schema Changes
```
I need to add a 'last_login' datetime column to the users table.

Please:
1. Use Database Inspector MCP to show current users table structure
2. Apply the schema change
3. Use Database Inspector MCP to verify the 'last_login' column exists
4. Show me the updated table structure
```

### Example 3: Test a Query
```
Use Database Inspector MCP to run this query and show results:

SELECT
  c.id,
  c.name,
  COUNT(pi.id) as playlist_count
FROM content c
LEFT JOIN playlist_items pi ON c.id = pi.contentId
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 10;
```

### Example 4: Seed Test Data
```
Use Database Inspector MCP to seed test data:
1. Create 3 test organizations
2. Create 2 users for each organization
3. Create 5 pieces of content per user

Then verify the data was created using vizora_db_query.
```

### Example 5: Verify Data Integrity After Migration
```
I'm running a database migration to rename the 'deviceId' column to 'deviceIdentifier'.

Please:
1. Use Database Inspector MCP to backup the current schema
2. Run the migration
3. Use Database Inspector MCP to verify the old column is gone
4. Use Database Inspector MCP to verify the new column exists
5. Run a sample query to confirm it works
```

### Example 6: Diagnose Data Issue
```
Users are reporting they can't see their content.

Please:
1. Use Database Inspector MCP to query:
   SELECT * FROM content WHERE organizationId='test-org' LIMIT 5;
2. Check if the content exists
3. Use Database Inspector MCP to verify the organizationId values match
4. Check if there are any NULL values in critical fields
```

### Example 7: Reset Database for Testing
```
Use Database Inspector MCP to:
1. Reset the entire database
2. Run all migrations
3. Seed fresh test data
4. Verify everything is in place

Then I'll run the full test suite.
```

---

## 🔧 SERVICE MANAGER MCP Examples

### Example 1: Health Check
```
Use Service Manager MCP to check the status of all Vizora services:
- Middleware service
- Web service
- Realtime service

Report which ones are running and which ports they're using.
```

### Example 2: Restart Services
```
Use Service Manager MCP to restart the middleware service.
Wait for it to fully start.
Verify it's running on port 3000.
```

### Example 3: Port Troubleshooting
```
I'm getting a "port 3000 already in use" error.

Please:
1. Use Service Manager MCP to check what's using port 3000
2. Kill the process if needed
3. Start the middleware service on port 3000
4. Verify it's running
```

### Example 4: Startup Sequence
```
Use Service Manager MCP to:
1. Start the middleware service (should be on port 3000)
2. Start the web service (should be on port 3001)
3. Start the realtime service (should be on port 3002)
4. Verify all three are running
5. Check that all required ports are available
```

### Example 5: Diagnose Slow Service
```
The API seems slow. Please:
1. Use Service Manager MCP to check service status
2. Check the logs for errors
3. Verify all services are running
4. Restart the middleware service if needed
```

### Example 6: Port Cleanup
```
Kill any processes using ports 3000, 3001, and 3002.
Then start all services fresh:
1. Middleware on 3000
2. Web on 3001
3. Realtime on 3002

Verify all three are running.
```

---

## 📊 MONITORING MCP Examples

### Example 1: Health Check
```
Use Monitoring MCP to verify the health of all services.
Show:
1. Each service status (up/down)
2. Response times
3. Error rates
```

### Example 2: Performance Baseline
```
Use Monitoring MCP to capture performance metrics:
1. API response times
2. WebSocket connection count
3. System resource usage (CPU, memory)

I'll optimize the code and then compare metrics.
```

### Example 3: After Deployment Check
```
I just deployed a new feature. Please:
1. Use Monitoring MCP to check health status
2. Monitor API response times
3. Check WebSocket connections
4. Compare to the baseline metrics

If anything degraded, alert me.
```

### Example 4: Performance Comparison
```
I optimized the content query. Please:
1. Use Monitoring MCP to get current API metrics
2. Restart the service
3. Run the same query multiple times
4. Use Monitoring MCP to show new metrics
5. Calculate the performance improvement percentage
```

### Example 5: Resource Monitoring
```
Use Monitoring MCP to show system metrics:
1. CPU usage
2. Memory usage
3. Disk I/O
4. Network usage

Alert me if any are above 80%.
```

### Example 6: WebSocket Diagnostics
```
Use Monitoring MCP to check WebSocket status:
1. Active connections
2. Connection errors
3. Average message latency
4. Peak connection times
```

---

## 🔀 GIT OPERATIONS MCP Examples

### Example 1: Check What Changed
```
Use Git Operations MCP to show me:
1. Current git status
2. List of modified files
3. The diff for key files

What am I about to commit?
```

### Example 2: Review Diff Before Committing
```
I made changes to authentication. Before I commit:
1. Use Git Operations MCP to show the diff
2. Review the changes
3. Confirm they match my intent

Only then create a commit.
```

### Example 3: Create a Feature Branch
```
Use Git Operations MCP to:
1. Show current branch
2. Create a new branch called 'feature/pagination'
3. Switch to the new branch
4. Confirm I'm on the new branch

Then I'll make my changes.
```

### Example 4: Commit Changes
```
Use Git Operations MCP to:
1. Show the status
2. Show the diff
3. Create a commit with the message: "Fix: Improve password hashing security (bcrypt 12->14)"
4. Show the commit log to confirm
```

### Example 5: Review Recent Commits
```
Use Git Operations MCP to show the last 10 commits.
Include:
- Commit hashes
- Commit messages
- Author
- Date

This will help me match the commit message style.
```

### Example 6: Merge Feature Branch
```
My feature branch is complete. Please:
1. Use Git Operations MCP to show the diff between my branch and main
2. Review the changes
3. Merge the branch into main
4. Confirm the merge was successful

Do NOT force push.
```

### Example 7: Safe Commit Workflow
```
I've made several changes. Please:
1. Use Git Operations MCP to show status
2. Review the diff
3. Compare against recent commits to match style
4. Create a properly formatted commit message
5. Commit the changes
6. Show me the final commit
```

---

## 🚀 COMBINED MCP Examples (Multiple MCPs)

### Example 1: Complete Bug Fix Workflow
```
I found a bug in the authentication logic. Fix it:

1. Use Git Operations MCP to create a feature branch called 'fix/auth-bug'

2. Identify and fix the bug in the code

3. Use Test Runner MCP to run all auth tests
   Make sure they all pass

4. Use Database Inspector MCP to verify user data integrity
   Run: SELECT * FROM users WHERE id='test-user-id';

5. Use Service Manager MCP to restart the middleware service

6. Use Git Operations MCP to:
   - Show the diff
   - Create a commit with message "Fix: Authentication logic bug"

7. Use Monitoring MCP to verify API health
```

### Example 2: Safe Database Migration
```
I need to rename a column in the users table from 'nickname' to 'displayName'.

Please:
1. Use Database Inspector MCP to show current users schema

2. Create and run the migration

3. Use Database Inspector MCP to verify:
   - 'nickname' column is gone
   - 'displayName' column exists

4. Use Test Runner MCP to run all tests
   Ensure no code still references 'nickname'

5. Use Service Manager MCP to restart services

6. Use Monitoring MCP to verify health

7. Use Git Operations MCP to commit these changes
```

### Example 3: Deploy with Full Validation
```
I'm ready to deploy the pagination feature. Please validate:

1. Use Git Operations MCP to:
   - Show status
   - Show diff
   - Confirm all changes are committed

2. Use Test Runner MCP to:
   - Run full test suite
   - Show coverage report

3. Use Database Inspector MCP to:
   - Verify schema is correct
   - Run sample query: SELECT * FROM content LIMIT 5;

4. Use Service Manager MCP to:
   - Check all services are running

5. Deploy

6. Use Monitoring MCP to:
   - Verify health
   - Show API response times
   - Monitor for errors

7. Use Git Operations MCP to:
   - Show commit log for deployment record
```

### Example 4: Performance Optimization Sprint
```
Let's optimize the content API. Please:

1. Use Monitoring MCP to get baseline metrics
   - API response times
   - Query performance

2. Use Database Inspector MCP to analyze current queries
   - Check for N+1 problems
   - Identify slow queries

3. Optimize the code based on findings

4. Use Test Runner MCP to verify nothing broke

5. Use Service Manager MCP to restart the service

6. Use Monitoring MCP to measure improvement
   - Compare response times
   - Show performance delta

7. Use Git Operations MCP to show changes
```

### Example 5: Full-Stack Feature Implementation
```
Implement the new dashboard feature with full validation:

1. Create feature branch with Git Operations MCP

2. Implement backend changes
   - Update database schema with Database Inspector MCP
   - Test with Test Runner MCP

3. Implement frontend changes
   - Update API client
   - Test with Test Runner MCP

4. Run comprehensive tests:
   - Unit tests with Test Runner MCP
   - E2E tests with Test Runner MCP
   - Coverage report with Test Runner MCP

5. Verify everything:
   - Service Manager MCP: All services running
   - Database Inspector MCP: Schema correct
   - Monitoring MCP: Performance metrics

6. Commit changes:
   - Use Git Operations MCP to review diff
   - Create commit with proper message
   - Show commit log

7. Merge to main and deploy
```

---

## 💡 Advanced Patterns

### Pattern: Autonomous Bug Investigation
```
Users report: "Cannot create content"

Please investigate using MCPs:

1. Use Database Inspector MCP to:
   - Check content table schema
   - Query recent content creation attempts
   - Check for errors

2. Use Test Runner MCP to:
   - Run content creation tests
   - Look for failing tests

3. Use Monitoring MCP to:
   - Check API error rates
   - Look for error patterns

4. Based on findings:
   - Fix the issue
   - Test with Test Runner MCP
   - Verify with Database Inspector MCP

5. Use Git Operations MCP to commit the fix
```

### Pattern: Continuous Performance Monitoring
```
Monitor performance over time:

1. Baseline: Use Monitoring MCP to capture metrics
2. Make changes: Optimize code, update indexes, add caching
3. Service Manager MCP: Restart service
4. Compare: Use Monitoring MCP to measure improvement
5. Document: Use Git Operations MCP to show what changed
6. Repeat: Identify next optimization opportunity
```

### Pattern: Safe Refactoring
```
Refactor auth service safely:

1. Git Operations MCP: Create feature branch
2. Test Runner MCP: Get baseline test results
3. Make changes step by step
4. After each change: Test Runner MCP - verify tests pass
5. Database Inspector MCP: Verify data integrity
6. Final validation: Test Runner MCP full suite
7. Git Operations MCP: Review diff and commit
```

### Pattern: Zero-Downtime Deployment
```
Deploy without downtime:

1. Monitoring MCP: Baseline metrics
2. Test Runner MCP: Full test suite passes
3. Service Manager MCP: Check all services healthy
4. Database Inspector MCP: Run migrations in transaction
5. Deploy
6. Service Manager MCP: Verify new version running
7. Monitoring MCP: Verify health and performance
8. Rollback plan ready with Git Operations MCP
```

---

## 🎓 Best Practices

### ✅ DO

```
"Use Test Runner MCP to verify my changes work"
"Use Database Inspector MCP before and after schema changes"
"Use Service Manager MCP to check if services are running"
"Use Git Operations MCP to review my diff before committing"
"Use Monitoring MCP to verify deployment health"
```

### ❌ DON'T

```
"Run tests" (should: Use Test Runner MCP to run tests)
"Check the database" (should: Use Database Inspector MCP to query/inspect)
"Is the service running?" (should: Use Service Manager MCP to check status)
"Show me changes" (should: Use Git Operations MCP to show diff)
"Is it working?" (should: Use Monitoring MCP to check health)
```

---

## 🔗 Reference

- **Full Guide:** `MCP_USAGE_GUIDE.md`
- **Cheat Sheet:** `MCP_CHEAT_SHEET.txt`
- **Visual Reference:** `MCP_SERVERS_REFERENCE.html`
- **Config:** `config/mcporter.json`

---

**Last Updated:** January 29, 2026
**All MCPs Operational:** ✅
