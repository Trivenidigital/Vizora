# BMAD Installation Guide for Vizora

## Quick Installation

**Run this command in the Vizora project root:**

```bash
cd C:\Projects\vizora\vizora
npx bmad-method@latest install
```

## Installation Steps

### 1. Confirm Package Installation
```
Need to install the following packages:
bmad-method@6.0.0-Beta.2
Ok to proceed? (y)
```
**Answer:** `y`

### 2. Installation Directory
```
Installation directory:
C:\Projects\vizora\vizora
```
**Answer:** Press `Enter` (default is correct)

### 3. Confirm Directory
```
Install to this directory?
> Yes / No
```
**Answer:** Press `Enter` (Yes is selected)

### 4. Select Modules
```
Select modules to install:
  [•] BMad Method Agile-AI Driven-Development
  [ ] BMad Builder
  [ ] Creative Innovation Suite
  [ ] Game Dev Suite
```
**Actions:**
1. Press `Down Arrow` once (to Builder)
2. Press `Space` (to select Builder)  
3. Press `Enter` (to confirm)

**Selected modules:**
- ✅ BMad Method (core framework)
- ✅ BMad Builder (for custom workflows)

### 5. Custom Modules
```
Add custom modules, agents, or workflows from your computer?
Yes / > No
```
**Answer:** Press `Enter` (No is selected)

### 6. Select Tools
```
Select tools to configure:
  [•] Claude Code ⭐
  [ ] Codex
  [ ] Cursor
  ...
```
**Answer:** Press `Enter` (Claude Code already selected)

### 7. User Name
```
What should agents call you?
Srila
```
**Action:** Clear and type `Srini`, then press `Enter`

### 8. Installation Completes
BMAD will:
- Install all files
- Set up configuration
- Show completion message

---

## What Gets Installed

```
vizora/
├── .bmad/                    # BMAD configuration
│   ├── config/              # User preferences
│   ├── agents/              # Specialized AI agents
│   ├── workflows/           # Structured development flows
│   └── modules/             # BMad Method + Builder
├── .bmad-custom/            # Your custom agents/workflows
└── .bmadignore              # Files to exclude from context
```

---

## After Installation

### 1. Verify Installation

```bash
# Check if .bmad directory exists
ls .bmad

# Should show:
# config/  agents/  workflows/  modules/
```

### 2. Get Help

In your AI coding tool (Claude Code, Cursor, etc.):

```
/bmad-help
```

This will guide you on what to do next!

### 3. Example: "How should I build Vizora?"

```
/bmad-help I have a multi-service platform with middleware, web, and realtime services. 
We have 3 critical blockers. How should I structure fixing them?
```

BMAD will provide tailored guidance based on your project!

---

## Quick Workflows

### For Bug Fixes (Our 3 Blockers)

```bash
# 1. Analyze and create spec
/quick-spec "Playlist assignment returns 404 despite data existing"

# 2. Implement with TDD
/dev-story

# 3. Validate quality
/code-review
```

### For New Features

```bash
# Full planning path
/product-brief
/create-prd
/create-architecture
/create-epics-and-stories
/sprint-planning

# Then implement each story
/dev-story
/code-review
```

---

## Integration with Our Workflow

BMAD + MCP + Fixed Ports = Perfect Development Process

```
BMAD Method
    ↓ (structured planning)
Development Work
    ↓ (implementation)
MCP Verification
    ↓ (automated checks)
Fixed Port Services
    ↓ (reliable infrastructure)
Production-Ready Code
```

---

## Next Steps After Installation

1. **Fix Blocker #1:** Playlist Assignment
   ```
   /quick-spec "Fix playlist assignment 404 error"
   /dev-story
   /code-review
   ```

2. **Fix Blocker #2:** Realtime Service Startup
   ```
   /quick-spec "Realtime service won't start on port 3002"
   /dev-story
   /code-review
   ```

3. **Fix Blocker #3:** Middleware Stability
   ```
   /create-architecture "Improve middleware error handling and stability"
   /create-epics-and-stories
   /dev-story [for each story]
   /code-review
   ```

---

## Troubleshooting Installation

### Installation Hangs
- Press `Ctrl+C` and restart
- Make sure you're in the correct directory
- Check internet connection

### Module Selection Issues
- Use `Space` to toggle selection
- Use `Enter` to confirm
- At least one module must be selected

### Directory Not Found
- Create the directory first: `mkdir -p C:\Projects\vizora\vizora`
- Make sure path has no typos

---

## Documentation

- **Official Docs:** http://docs.bmad-method.org/
- **GitHub:** https://github.com/bmad-code-org/BMAD-METHOD
- **Getting Started:** http://docs.bmad-method.org/tutorials/getting-started/

---

## Why BMAD for Vizora?

**Today's experience showed us:**
- ❌ Unstructured development → chaos
- ❌ No planning → multiple conflicting changes
- ❌ Random debugging → wasted time

**BMAD provides:**
- ✅ Structured workflows
- ✅ Planning before coding
- ✅ TDD approach
- ✅ Quality gates
- ✅ AI as a guide, not a replacement

**Expected Results:**
- 90% fewer defects
- 50% faster development (less rework)
- Always up-to-date documentation
- Clear process for every task

---

**Ready to install?** Run the command at the top and follow the steps!

Once installed, come back and we'll fix those 3 critical blockers properly using BMAD workflows! 🚀
