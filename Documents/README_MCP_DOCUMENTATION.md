# 📚 Vizora MCP Documentation Index

## 🎯 Start Here

**First time using MCPs?** → Read: `MCP_QUICK_START.md` (5 minutes)

**Need specific examples?** → See: `MCP_PROMPT_EXAMPLES.md`

**Want the full guide?** → Read: `MCP_USAGE_GUIDE.md`

**Need a quick reference?** → Check: `MCP_CHEAT_SHEET.txt`

---

## 📁 Documentation Files

### Quick References
| File | Purpose | Read Time |
|------|---------|-----------|
| **MCP_QUICK_START.md** | TL;DR guide with templates | 5 min |
| **MCP_CHEAT_SHEET.txt** | Quick reference for all tools | 2 min (reference) |
| **MCP_SERVERS_REFERENCE.html** | Visual reference with diagrams | 5 min |

### Detailed Guides
| File | Purpose | Read Time |
|------|---------|-----------|
| **MCP_USAGE_GUIDE.md** | Comprehensive guide + patterns | 20 min |
| **MCP_PROMPT_EXAMPLES.md** | 30+ copy-paste prompt templates | 15 min |

### Reference
| File | Purpose |
|------|---------|
| **MCP_SERVERS_REFERENCE.html** | Configuration & technical specs |

---

## 🔌 The 5 MCP Servers

```
1. Test Runner MCP
   - Run tests, coverage reports, E2E tests
   - Tools: vizora_test_run, vizora_test_coverage, vizora_test_e2e

2. Database Inspector MCP
   - Query database, inspect schema, seed data, migrate
   - Tools: vizora_db_query, vizora_db_inspect, vizora_db_migrate

3. Service Manager MCP
   - Start/stop services, check ports, manage processes
   - Tools: vizora_service_status, vizora_port_check, vizora_service_restart

4. Git Operations MCP
   - Manage branches, commits, diffs, logs
   - Tools: vizora_git_status, vizora_git_commit, vizora_git_diff

5. Monitoring MCP
   - Check health, monitor metrics, track performance
   - Tools: vizora_health_check, vizora_metrics_api, vizora_metrics_system
```

---

## 🎓 How to Use MCPs in Prompts

### The Golden Rule
**Always use the keyword "MCP" when referencing a server:**

```
❌ "Run tests"
✅ "Use Test Runner MCP to run tests"

❌ "Check the database"
✅ "Use Database Inspector MCP to verify the schema"

❌ "Is the service running?"
✅ "Use Service Manager MCP to check service status"
```

### Basic Template
```
"Use [MCP Name] MCP to [action]"

Example:
"Use Test Runner MCP to run all tests and show coverage"
```

### Advanced Template
```
"Please:
1. Use [MCP1] MCP to [action1]
2. Use [MCP2] MCP to [action2]
3. Use [MCP3] MCP to [action3]"

Example:
"Please:
1. Use Test Runner MCP to run tests
2. Use Database Inspector MCP to verify data integrity
3. Use Service Manager MCP to restart the service"
```

---

## 📝 Common Tasks & Prompts

### Task: Test Code Changes
```
Use Test Runner MCP to run tests and show coverage report
```
**See:** `MCP_PROMPT_EXAMPLES.md` → Test Runner Examples

---

### Task: Verify Database Changes
```
Use Database Inspector MCP to show the table structure before and after the change
```
**See:** `MCP_PROMPT_EXAMPLES.md` → Database Inspector Examples

---

### Task: Check Service Health
```
Use Service Manager MCP to verify all services are running on their correct ports
```
**See:** `MCP_PROMPT_EXAMPLES.md` → Service Manager Examples

---

### Task: Review Code Before Commit
```
Use Git Operations MCP to show the diff, then create a commit with an appropriate message
```
**See:** `MCP_PROMPT_EXAMPLES.md` → Git Operations Examples

---

### Task: Monitor Deployment
```
Use Monitoring MCP to check service health and API metrics post-deployment
```
**See:** `MCP_PROMPT_EXAMPLES.md` → Monitoring Examples

---

## 🚀 Real-World Example: Safe Bug Fix

### The Challenge
You found a bug and want to fix it safely with full validation.

### The Solution
Use multiple MCPs in sequence:

```
"Fix the authentication bug. Please:

1. Use Test Runner MCP to identify failing tests
   (what's currently broken?)

2. Modify the code to fix the bug
   (implement the fix)

3. Use Test Runner MCP to verify tests now pass
   (is it fixed?)

4. Use Database Inspector MCP to verify user data integrity
   (did we break anything?)

5. Use Service Manager MCP to restart the middleware service
   (apply the changes)

6. Use Monitoring MCP to verify API health
   (is it working in production?)

7. Use Git Operations MCP to show the diff and create a commit
   (document the change)"
```

### Why This Works
- ✅ Tests identify the problem
- ✅ Code is fixed
- ✅ Tests confirm the fix
- ✅ Data integrity is verified
- ✅ Service is restarted
- ✅ Health is monitored
- ✅ Change is documented

---

## 💡 Pro Tips

### Tip 1: Always Test After Changes
```
After any code change, use:
"Use Test Runner MCP to run tests"
```

### Tip 2: Verify Before AND After
```
For database changes:
"Use Database Inspector MCP to show schema BEFORE,
then make the change,
then use Database Inspector MCP to show schema AFTER"
```

### Tip 3: Chain MCPs for Complete Validation
```
Don't just test one thing:
"Use Test Runner MCP to run tests,
then use Database Inspector MCP to verify data,
then use Monitoring MCP to check performance"
```

### Tip 4: Monitor Deployments
```
Always capture metrics before/after:
"Use Monitoring MCP to get baseline metrics,
deploy the feature,
then use Monitoring MCP to show new metrics"
```

---

## 🎯 Learning Path

### Beginner (30 minutes)
1. Read: `MCP_QUICK_START.md` (5 min)
2. Skim: `MCP_CHEAT_SHEET.txt` (5 min)
3. Review: `MCP_SERVERS_REFERENCE.html` (10 min)
4. Try: Copy a prompt from `MCP_PROMPT_EXAMPLES.md`

### Intermediate (1 hour)
1. Read: `MCP_USAGE_GUIDE.md` (20 min)
2. Study: `MCP_PROMPT_EXAMPLES.md` (20 min)
3. Practice: Create 3 of your own prompts combining MCPs

### Advanced (2 hours)
1. Review: All patterns in `MCP_USAGE_GUIDE.md`
2. Create: Custom workflows combining 4-5 MCPs
3. Optimize: Build complex validation chains

---

## 📋 Prompt Template Checklists

### ✅ For Testing
- [ ] Use Test Runner MCP to run tests
- [ ] Show coverage report
- [ ] Identify failing tests (if any)
- [ ] Suggest fixes

### ✅ For Database Changes
- [ ] Show schema BEFORE
- [ ] Make the change
- [ ] Show schema AFTER
- [ ] Run tests to verify
- [ ] Check data integrity

### ✅ For Deployments
- [ ] Test suite passes (Test Runner)
- [ ] Schema is correct (Database Inspector)
- [ ] Services are running (Service Manager)
- [ ] Deploy
- [ ] Verify health (Monitoring)

### ✅ For Code Changes
- [ ] Run tests (Test Runner)
- [ ] Verify data (Database Inspector if applicable)
- [ ] Review diff (Git Operations)
- [ ] Create commit (Git Operations)

---

## 🔗 Quick Links

| Need | Resource |
|------|----------|
| Quickly get started | `MCP_QUICK_START.md` |
| Find a specific example | `MCP_PROMPT_EXAMPLES.md` |
| All tools reference | `MCP_CHEAT_SHEET.txt` |
| Full documentation | `MCP_USAGE_GUIDE.md` |
| Visual reference | `MCP_SERVERS_REFERENCE.html` |
| Configuration | `config/mcporter.json` |

---

## ❓ Frequently Asked Questions

### Q: What's the difference between using MCPs and not?
**A:** Without MCPs: Manual testing, manual verification, manual restarts
**With MCPs:** Automatic testing, automatic verification, automatic restarts - all in one prompt

### Q: Do I need to memorize the MCP names?
**A:** No! This documentation has all the names. Just reference the guides.

### Q: Can I use multiple MCPs in one prompt?
**A:** Yes! That's actually recommended for comprehensive validation. See examples.

### Q: What if a tool fails?
**A:** Claude will report the error and suggest fixes. Most errors are minor (typos, wrong parameters).

### Q: Can I create custom workflows?
**A:** Yes! Combine any MCPs in any order. See the "Combined MCP Examples" section.

### Q: How do I know which MCP to use?
**A:** See the "Common Tasks & Prompts" section or look at `MCP_CHEAT_SHEET.txt`

---

## 🎁 Bonus: Pre-Made Workflows

### Workflow 1: Safe Code Change
```
1. Use Test Runner MCP to get baseline tests
2. Make your code change
3. Use Test Runner MCP to verify tests pass
4. Use Git Operations MCP to show diff
5. Create commit
```

### Workflow 2: Database Migration
```
1. Use Database Inspector MCP to show schema
2. Create migration
3. Use Database Inspector MCP to verify change
4. Use Test Runner MCP to ensure tests pass
5. Use Git Operations MCP to commit
```

### Workflow 3: Performance Optimization
```
1. Use Monitoring MCP to get baseline metrics
2. Identify optimization opportunity
3. Implement optimization
4. Use Service Manager MCP to restart
5. Use Monitoring MCP to measure improvement
6. Use Git Operations MCP to commit changes
```

### Workflow 4: Complete Feature Deployment
```
1. Use Test Runner MCP - run full suite
2. Use Database Inspector MCP - verify schema
3. Use Service Manager MCP - check health
4. Deploy feature
5. Use Monitoring MCP - verify post-deployment health
6. Use Git Operations MCP - create deployment commit
```

---

## 🚀 Next Steps

1. **Pick a task** you need to do
2. **Find it** in the quick reference
3. **Copy the prompt template**
4. **Adapt it** to your specific needs
5. **Use it** in your prompt to Claude
6. **Watch** Claude use the MCPs automatically!

---

## 📞 Support

- **Quick answers** → Check `MCP_CHEAT_SHEET.txt`
- **Specific task** → Search `MCP_USAGE_GUIDE.md`
- **Prompt ideas** → Browse `MCP_PROMPT_EXAMPLES.md`
- **Technical details** → See `MCP_SERVERS_REFERENCE.html`

---

**Status:** ✅ All MCPs operational and documented
**Last Updated:** January 29, 2026
**Ready to Use:** Yes! Start with `MCP_QUICK_START.md`
