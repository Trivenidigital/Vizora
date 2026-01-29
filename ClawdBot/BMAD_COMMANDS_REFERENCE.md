# BMAD Commands Reference for Vizora
**Quick lookup guide** | 1-minute reference
**Date:** January 28, 2026

---

## 🚀 Start Here Commands

### For Getting Help
```bash
/bmad-help                                      # Get unstuck
/bmad-help "I don't know how to fix..."        # Specific help
```

### For Quick Fixes
```bash
/quick-spec "[describe the bug]"               # Analyze problem
/bmad-dev-story                                # Implement fix
/bmad-code-review                              # Validate
```

---

## 📊 Analysis Commands

| Command | What It Does | Best For |
|---------|-------------|----------|
| `/bmad-quick-spec` | Fast technical analysis | Bug investigation (5 min) |
| `/bmad-research` | Deep technical research | Understanding patterns |
| `/bmad-create-product-brief` | Capture requirements | New features |
| `/bmad-editorial-review-prose` | Content review | Documentation |
| `/bmad-editorial-review-structure` | Structure review | Document organization |

---

## 🏗️ Architecture Commands

| Command | What It Does | Output |
|---------|-------------|--------|
| `/bmad-create-architecture` | System design | Architecture document |
| `/bmad-create-excalidraw-diagram` | Create diagrams | Excalidraw file |
| `/bmad-create-excalidraw-flowchart` | Flow diagrams | Process flow |
| `/bmad-create-excalidraw-dataflow` | Data flows | Data architecture |
| `/bmad-create-excalidraw-wireframe` | UI wireframes | UI design |

---

## 🎨 Design Commands

| Command | What It Does | Best For |
|---------|-------------|----------|
| `/bmad-create-ux-design` | UX/UI design | Frontend changes |
| `/bmad-create-prd` | Full PRD document | Major features |

---

## 💻 Implementation Commands

| Command | What It Does | Includes |
|---------|-------------|----------|
| `/bmad-create-epics-and-stories` | Break down work | Stories with criteria |
| `/bmad-create-story` | Single story | Story details |
| `/bmad-dev-story` | Implement story | Code + Tests + Commit |
| `/bmad-quick-dev` | Quick feature | Rapid implementation |
| `/bmad-quick-flow-solo-dev` | Solo dev workflow | Streamlined process |

---

## ✅ Testing Commands

| Command | What It Does | Covers |
|---------|-------------|--------|
| `/bmad-testarch-test-design` | Test strategy | What to test |
| `/bmad-testarch-atdd` | Acceptance test dev | Feature validation |
| `/bmad-testarch-automate` | Test automation | CI/CD integration |
| `/bmad-testarch-ci` | Pipeline setup | Build & test |
| `/bmad-testarch-framework` | Framework selection | Testing tech |
| `/bmad-testarch-nfr` | Non-functional tests | Performance, load, etc |
| `/bmad-testarch-test-review` | Test validation | Coverage check |
| `/bmad-testarch-trace` | Traceability | Requirements → Tests |

---

## 🔍 Review Commands

| Command | What It Does | Validates |
|---------|-------------|-----------|
| `/bmad-code-review` | Code review | Quality gates |
| `/bmad-check-implementation-readiness` | Implementation check | Completeness |
| `/bmad-correct-course` | Fix issues | Course correction |
| `/bmad-review-adversarial-general` | Adversarial review | Edge cases |
| `/bmad-retrospective` | Sprint retrospective | Lessons learned |

---

## 📚 Documentation Commands

| Command | What It Does | Produces |
|---------|-------------|----------|
| `/bmad-document-project` | Full project docs | Complete documentation |
| `/bmad-index-docs` | Document indexing | Searchable index |
| `/bmad-shard-doc` | Optimize docs | Clean, organized docs |
| `/bmad-tech-writer-tech-writer` | Technical writing | Professional docs |

---

## 👥 Team Commands

| Command | What It Does | Best For |
|---------|-------------|----------|
| `/bmad-sprint-planning` | Sprint planning | Team planning |
| `/bmad-sprint-status` | Status report | Progress update |
| `/bmad-party-mode` | Collaborative planning | Team brainstorm |

---

## 🤖 Agent Commands

| Command | Agent | Purpose |
|---------|-------|---------|
| `/bmad-bmad-master` | Master Orchestrator | Overall coordination |
| `/bmad-pm` | Product Manager | Requirements & priorities |
| `/bmad-architect` | Architect | System design |
| `/bmad-dev` | Developer | Implementation |
| `/bmad-ux-designer` | UX Designer | Interface design |
| `/bmad-tea` | QA/Tea | Testing strategy |
| `/bmad-sm` | Scrum Master | Process management |
| `/bmad-tech-writer` | Tech Writer | Documentation |
| `/bmad-analyst` | Analyst | Research & analysis |

---

## 🎯 Workflow Decision Tree

```
What do you need?
│
├─ To understand a bug?
│  └─ /quick-spec "describe bug"
│
├─ To plan a feature?
│  └─ /bmad-create-product-brief "feature"
│
├─ To design a system?
│  └─ /bmad-create-architecture "system"
│
├─ To implement something?
│  └─ /bmad-dev-story "with tests"
│
├─ To validate quality?
│  └─ /bmad-code-review "before merge"
│
├─ To design UI/UX?
│  └─ /bmad-create-ux-design "interface"
│
├─ To create diagrams?
│  └─ /bmad-create-excalidraw-diagram "diagram"
│
├─ To test something?
│  └─ /bmad-testarch-* "test type"
│
├─ To document?
│  └─ /bmad-document-project "docs"
│
├─ To get unstuck?
│  └─ /bmad-help "what's wrong"
│
└─ For team collaboration?
   └─ /bmad-party-mode "topic"
```

---

## 🔄 Common Workflow Sequences

### Quick Bug Fix (30 min)
```bash
/quick-spec "[bug description]"
/bmad-dev-story
/bmad-code-review
# Done ✓
```

### New Feature (2-4 hours)
```bash
/bmad-create-product-brief "[feature]"
/bmad-create-architecture "[design]"
/bmad-create-epics-and-stories
/bmad-dev-story # for each story
/bmad-code-review # for each
# Done ✓
```

### Major System Change (3-5 days)
```bash
/bmad-create-architecture "[big change]"
/bmad-create-excalidraw-diagram "[flow]"
/bmad-review-adversarial-general
/bmad-create-epics-and-stories
/bmad-testarch-test-design "[strategy]"
/bmad-dev-story # for each story
/bmad-testarch-atdd "[end-to-end]"
/bmad-document-project "[update docs]"
# Done ✓
```

---

## 💡 Pro Tips

### Tip 1: Chain Commands
```bash
# Build on previous output
/bmad-create-product-brief "Feature"
# Read output
/bmad-create-architecture "Using brief above"
# Read output
/bmad-create-epics-and-stories
# Each builds on previous
```

### Tip 2: Use Agents by Role
```bash
# Architect for design questions
/bmad-create-architecture

# Developer for implementation
/bmad-dev-story

# QA for testing
/bmad-testarch-test-design

# Tech Writer for docs
/bmad-document-project
```

### Tip 3: Always Code Review
```bash
# Every single change
/bmad-code-review
# Before pushing to git
```

### Tip 4: Document as You Go
```bash
# Not after
/bmad-document-project "updates"
# While building
```

---

## 🚨 When to Use Each

### Use `/quick-spec` When:
- You're investigating a bug
- You need root cause analysis
- You need a solution approach
- Time is limited (5-30 min)
- Scope is narrow

### Use `/bmad-create-product-brief` When:
- Starting a new feature
- Capturing requirements
- Planning work
- Need buy-in on approach

### Use `/bmad-create-architecture` When:
- Designing a system
- Multiple services affected
- Need to validate design
- Risk assessment needed

### Use `/bmad-dev-story` When:
- Ready to implement
- Have clear requirements
- Want TDD approach
- Need git commit

### Use `/bmad-code-review` When:
- Implementation complete
- Tests all passing
- Ready to merge
- Need quality validation

### Use `/bmad-testarch-*` When:
- Planning test approach
- Setting up automation
- Validating coverage
- Non-functional requirements

### Use `/bmad-document-project` When:
- Work is complete
- Need user-facing docs
- Team onboarding
- Knowledge base update

---

## 📱 Mobile Quick Reference

**Q: I found a bug. What do I do?**
```bash
A: /quick-spec "describe bug"
   Then /bmad-dev-story
   Then /bmad-code-review
```

**Q: I want to add a feature. What do I do?**
```bash
A: /bmad-create-product-brief "feature"
   Then /bmad-create-architecture
   Then /bmad-dev-story
   Then /bmad-code-review
```

**Q: I'm stuck. What do I do?**
```bash
A: /bmad-help "what you're stuck on"
```

**Q: Code is ready. What's next?**
```bash
A: /bmad-code-review
   (If passes)
   git push to production
```

---

## 🎓 Learning Resources

**Official:**
- Docs: http://docs.bmad-method.org/
- GitHub: https://github.com/bmad-code-org/BMAD-METHOD
- Getting Started: http://docs.bmad-method.org/tutorials/getting-started/

**Local:**
- Read BMAD_VIZORA_QUICK_START.md (2 min)
- Read BMAD_SETUP_ASSESSMENT.md (5 min)
- Read BMAD_BLOCKER_RESOLUTION_PLAN.md (5 min)

---

## ⚡ TL;DR (30 seconds)

1. Bug fix? → `/quick-spec` → `/bmad-dev-story` → `/bmad-code-review`
2. New feature? → `/bmad-create-product-brief` → `/bmad-create-architecture` → `/bmad-dev-story`
3. Stuck? → `/bmad-help`
4. Review code? → `/bmad-code-review`
5. Document? → `/bmad-document-project`

---

**Print this page and keep it handy!** 📄

