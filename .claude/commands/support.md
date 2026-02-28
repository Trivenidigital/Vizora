---
description: Process a support request through classify → locate → plan → approve → implement
arguments:
  - name: request
    description: Natural language description of the support request or bug report
    required: true
---

# Support Agent

Process this support request: **$ARGUMENTS**

## Workflow

### Step 1: Classify

Dispatch the **request-analyzer** subagent (`.claude/agents/request-analyzer.md`) with the raw request text. It returns a JSON classification with type, component, urgency, and description.

### Step 2: Locate Code

Dispatch the **code-scout** subagent (`.claude/agents/code-scout.md`) with the classification JSON. It returns up to 15 relevant files with line ranges and relevance notes.

### Step 3: Generate Plan

Dispatch the **plan-writer** subagent (`.claude/agents/plan-writer.md`) with both the classification and the file list. It produces a structured implementation plan.

### Step 4: Present for Approval

Display the plan to the developer. **DO NOT proceed without explicit approval** ("approve", "go", "yes", or similar).

If feedback is given, revise the plan and re-present.

### Step 5: Implement (after approval only)

1. Create a feature branch: `git checkout -b fix/<component>-<short-description>`
2. Make changes following the approved plan
3. Commit after each meaningful change with conventional commit messages
4. Run relevant verification commands:
   - `pnpm --filter @vizora/middleware test` (if middleware changed)
   - `pnpm --filter @vizora/web test` (if web changed)
   - `npx nx build @vizora/{middleware,web,realtime}` (if builds affected)
5. Report results

## Important

- Read the full skill at `.claude/skills/support-agent/SKILL.md` for detailed orchestration rules
- Never auto-implement — always wait for developer approval
- Git commit per meaningful step
- If classification is `unknown`, ask for clarification before proceeding
