# BMAD Quick Start Guide for Vizora Development
**Date:** January 28, 2026
**Status:** Ready to use immediately

---

## 🚀 Start Here (2 Minutes)

Your BMAD installation is complete and ready. Here's what to do right now:

### Option 1: Fix a Bug (Immediate)
```bash
# Report the bug to get structured analysis
/quick-spec "Playlist assignment returns 404"

# This will:
1. Analyze your codebase
2. Find root cause
3. Create fix specification
4. Show you the implementation plan
```

### Option 2: Learn BMAD First (10 Minutes)
```bash
# Get oriented to BMAD
/bmad-help "How do I use BMAD for bug fixes?"

# Then follow the guidance it provides
```

### Option 3: Start Fresh Feature (Planning)
```bash
# If you want to build something new
/bmad-create-product-brief "Add [feature name]"

# This captures requirements, not code
```

---

## 🎯 The BMAD Mindset

### Before: Ad-hoc Development
```
Problem Found
    ↓ (guess at cause)
Code Changed
    ↓ (hope it works)
Test ✗
    ↓ (repeat)
```

### After: BMAD Development
```
Problem Found
    ↓ (analyze with /quick-spec)
Specification Created
    ↓ (implement with /dev-story)
Tests Pass ✓
    ↓ (validate with /code-review)
Merge Confident
```

---

## 📋 Common Workflows for Vizora

### Workflow 1: Fix a Bug (15 minutes)

**Situation:** Playlist assignment returns 404 despite data existing

```bash
# Step 1: Analyze (Analyst agent)
/quick-spec "Playlist assignment returns 404 despite data existing"

# Read the output:
# - Root cause analysis
# - Affected code locations
# - Proposed solution
# - Test strategy
# - Implementation plan

# Step 2: Implement (Developer agent)
/bmad-dev-story

# System will prompt:
# - Scope confirmation
# - Dependencies check
# - Test coverage plan
# - Implementation steps

# Step 3: Validate (QA + Code Review)
/bmad-code-review

# Reviews:
# - Code quality
# - Test coverage
# - Specification match
# - No regressions
```

**Result:** Git commit with fix, all tests passing, fully documented

---

### Workflow 2: Add a Feature (1-2 hours)

**Situation:** Add device nickname editing capability

```bash
# Step 1: Capture requirements
/bmad-create-product-brief "Allow users to edit device nicknames"

# Step 2: Design system
/bmad-create-architecture "Device nickname editing"

# Step 3: Break into stories
/bmad-create-epics-and-stories

# Step 4: Implement each story
/bmad-dev-story  # Run for each story
/bmad-code-review  # After each story

# Step 5: Integration testing
/bmad-testarch-atdd "End-to-end nickname editing"
```

**Result:** Complete feature, all tests, documented, ready to deploy

---

### Workflow 3: Fix System Issues (30-60 minutes)

**Situation:** Realtime service won't start on port 3002

```bash
# Step 1: Root cause analysis
/quick-spec "Realtime service won't start on port 3002"

# Step 2: Architecture review
/bmad-create-architecture "Fix realtime service startup"

# Step 3: Implement fix (may span multiple services)
/bmad-dev-story

# Step 4: Test with MCP servers
/bmad-testarch-ci "Verify all services start together"

# Step 5: Code review
/bmad-code-review
```

**Result:** System fixed, services healthy, documented changes

---

## 🎮 Interactive Mode: Chat with BMAD

### When You're Stuck
```bash
/bmad-help "I don't know how to fix the playlist 404 error"

# Get:
# - Step-by-step guidance
# - Workflow recommendations
# - Next actions
```

### When You Need Collaboration
```bash
/bmad-party-mode "Planning device nickname feature"

# Enables:
# - Multi-person brainstorming
# - Structured discussion
# - Documented decisions
# - Actionable outcomes
```

### When You Need Architecture Help
```bash
/bmad-create-architecture "Should we add caching to device endpoints?"

# Get:
# - Design options with trade-offs
# - Implementation complexity
# - Performance impact
# - Risk assessment
```

---

## 📊 Vizora-Specific Workflows

### For Middleware (NestJS) Changes
```bash
1. /quick-spec "Describe the API change"
2. /bmad-create-architecture "Validate design"
3. /bmad-dev-story "Implement service method"
4. /bmad-testarch-test-design "Plan API tests"
5. /bmad-code-review "Validate API contract"
```

### For Realtime (Socket.IO) Changes
```bash
1. /quick-spec "Describe the socket event"
2. /bmad-create-excalidraw-diagram "Event flow diagram"
3. /bmad-dev-story "Implement handler"
4. /bmad-testarch-atdd "Test WebSocket flow"
5. /bmad-code-review "Validate contracts"
```

### For Web (Next.js) UI Changes
```bash
1. /bmad-create-ux-design "Design the UI"
2. /bmad-create-excalidraw-wireframe "Create wireframe"
3. /bmad-dev-story "Implement component"
4. /bmad-testarch-test-design "Component testing"
5. /bmad-code-review "Design & code review"
```

### For Display (Electron) Changes
```bash
1. /quick-spec "Describe the client change"
2. /bmad-create-excalidraw-diagram "Device interaction diagram"
3. /bmad-dev-story "Implement feature"
4. /bmad-testarch-test-design "Device testing"
5. /bmad-code-review "Validate pairing"
```

---

## 🔄 The BMAD Cycle

Every task follows this proven pattern:

```
1. THINK     ← Understand the problem deeply
   /quick-spec, /bmad-create-architecture, /bmad-create-product-brief

2. DESIGN    ← Plan the solution
   /bmad-create-excalidraw-*, /bmad-create-ux-design

3. PLAN      ← Break into implementable steps
   /bmad-create-epics-and-stories, /bmad-create-story

4. BUILD     ← Implement with tests
   /bmad-dev-story (has TDD built-in)

5. MEASURE   ← Verify quality
   /bmad-testarch-test-design, /bmad-testarch-atdd

6. ANALYZE   ← Review for improvements
   /bmad-code-review, /bmad-retrospective

7. DEPLOY    ← Ship with confidence
   Git commit + push (done via /dev-story)
```

---

## 💡 Pro Tips for Vizora

### Tip 1: Start with `/quick-spec`
Every problem should start here. Even if it seems obvious.
```bash
/quick-spec "Describe your problem or requirement"
# Gets you:
# - Structured analysis
# - Root cause analysis
# - Implementation strategy
# - Test plan
```

### Tip 2: Use Diagrams for Architecture
Vizora has 4 services that interact. Use diagrams:
```bash
/bmad-create-excalidraw-dataflow "Device pairing flow"
/bmad-create-excalidraw-diagram "Service communication"
/bmad-create-excalidraw-flowchart "Authentication flow"
```

### Tip 3: TDD is Built-In
When you run `/bmad-dev-story`, it includes:
1. Test file creation
2. Red phase (tests fail)
3. Green phase (code passes tests)
4. Refactor phase (improve)
5. Git commit

Don't skip testing—it's built-in.

### Tip 4: Code Review is Non-Negotiable
```bash
/bmad-code-review
# Checks:
# - Matches specification ✓
# - Tests coverage ✓
# - No regressions ✓
# - Code quality ✓
# - Documentation ✓
```

Every change goes through this. Period.

### Tip 5: Document as You Go
Use:
```bash
/bmad-document-project "For updated docs after each feature"
/bmad-tech-writer-tech-writer "For technical documentation"
```

---

## 📱 Your First 3 Tasks with BMAD

### Today: Fix the 3 Blockers

**Blocker #1: Playlist Assignment 404**
```bash
/quick-spec "Playlist assignment returns 404 despite data existing"
/bmad-dev-story
/bmad-code-review
# Then push to git
```

**Blocker #2: Realtime Service Port**
```bash
/quick-spec "Realtime service won't start on port 3002"
/bmad-dev-story
/bmad-code-review
```

**Blocker #3: Middleware Stability**
```bash
/quick-spec "Middleware crashes on invalid requests"
/bmad-dev-story
/bmad-code-review
```

**Time Estimate:** 1-2 hours total using BMAD
**Result:** 3 blockers fixed, all documented, all tested

---

### This Week: Build Something New

**Feature: Device Groups**
```bash
1. /bmad-create-product-brief "Allow grouping devices"
2. /bmad-create-architecture "Device group schema"
3. /bmad-create-excalidraw-diagram "Group management flow"
4. /bmad-create-epics-and-stories "Break into tasks"
5. /bmad-dev-story # For each story
6. /bmad-code-review # For each story
7. /bmad-testarch-atdd "Full flow testing"
```

---

### Next Week: System Documentation

**Deliverable: Complete API Documentation**
```bash
/bmad-document-project "Generate all docs"
/bmad-tech-writer-tech-writer "Polish documentation"
# Creates:
# - API documentation
# - Architecture documentation
# - Deployment guide
# - Troubleshooting guide
```

---

## 🎓 Learning BMAD

### Quick Videos (If Available)
- Check BMAD GitHub: https://github.com/bmad-code-org/BMAD-METHOD
- Official docs: http://docs.bmad-method.org/

### Learning by Doing
1. Start with `/quick-spec` on something small
2. See the analysis it produces
3. Run `/bmad-dev-story` and implement
4. Run `/bmad-code-review` and learn standards
5. Repeat with bigger tasks

### Getting Help
```bash
/bmad-help "I don't understand [concept]"
# Get tailored help
```

---

## ⚠️ Common Mistakes (Avoid These)

### ❌ Mistake 1: Skip the spec, jump to coding
```
WRONG:  Code first, hope it's right ✗
RIGHT:  /quick-spec first, then code ✓
```

### ❌ Mistake 2: Skip code review
```
WRONG:  Code looks good, merge it ✗
RIGHT:  Run /bmad-code-review always ✓
```

### ❌ Mistake 3: Skip tests
```
WRONG:  "I'll test manually" ✗
RIGHT:  /bmad-dev-story includes tests ✓
```

### ❌ Mistake 4: Unclear requirements
```
WRONG:  "Just add error handling" ✗
RIGHT:  /quick-spec "Describe specifically" ✓
```

### ❌ Mistake 5: No documentation
```
WRONG:  "It's obvious from the code" ✗
RIGHT:  /bmad-document-project after changes ✓
```

---

## 🚦 Decision Guide: Which Workflow to Use?

```
Is it a bug?
  YES → /quick-spec
  NO  → Is it a new feature?
         YES → /bmad-create-product-brief
         NO  → Is it a system change?
                YES → /bmad-create-architecture
                NO  → Not sure?
                      → /bmad-help
```

---

## 📞 When to Use Me (Claude) vs BMAD Workflows

### Use Me For:
- Quick questions about code
- Understanding existing code
- Debugging logic errors
- Refactoring suggestions
- Technical explanations

### Use BMAD Workflows For:
- Starting new tasks
- Planning before coding
- Making big architectural decisions
- Quality validation
- Team collaboration
- Documentation

### Use Both Together:
```
You: "I want to add feature X"
    ↓
BMAD: /bmad-create-product-brief (structure)
    ↓
Me: "Here's the current code context..."
    ↓
BMAD: /bmad-create-architecture (design)
    ↓
Me: "Let me implement this..."
    ↓
BMAD: /bmad-code-review (validation)
```

---

## 🎯 Success Checklist

Before starting any task in BMAD, make sure:

```
□ Problem is clearly defined
□ Requirements are documented
□ Scope is manageable (1-2 hours or less)
□ Success criteria are clear
□ You know what "done" looks like
```

---

## 🏁 Ready to Start?

### Pick One:

**Option A: Fix a Bug Right Now (15 min)**
```bash
/quick-spec "Playlist assignment returns 404"
```

**Option B: Learn BMAD First (10 min)**
```bash
/bmad-help
```

**Option C: Plan a Feature (20 min)**
```bash
/bmad-create-product-brief "Device groups"
```

---

**You're ready. BMAD is ready. Let's build with confidence!** 🚀

