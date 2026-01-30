# Development Workflow & Code Change Guardrails

**Problem:** Today we experienced multiple code changes without proper planning, leading to:
- Same files changed multiple times
- Conflicting fixes
- Lost context
- Regression of working features

**Solution:** Implement proven software development practices with guardrails.

---

## Change Management Process

### BEFORE Making ANY Code Change

1. **Document the Problem**
   - What's broken? (symptoms, not assumptions)
   - How to reproduce?
   - What's the expected behavior?

2. **Root Cause Analysis**
   - Debug first, code second
   - Use logs, debuggers, tests
   - Verify hypothesis before changing code

3. **Design the Fix**
   - What needs to change?
   - Are there side effects?
   - Is there a simpler solution?

4. **Plan the Change**
   - Which files will be modified?
   - What's the testing strategy?
   - Can it be done incrementally?

### Making the Change

5. **Create a Branch** (if using Git)
   ```bash
   git checkout -b fix/issue-name
   ```

6. **Make Atomic Changes**
   - One logical change at a time
   - Test after each change
   - Commit frequently with clear messages

7. **Test Thoroughly**
   - Unit tests for changed functions
   - Integration tests for affected flows
   - Manual testing of user scenarios

8. **Document the Change**
   - Update CHANGELOG.md
   - Add inline comments for non-obvious code
   - Update relevant documentation

### After the Change

9. **Code Review** (even if self-review)
   - Read your own diff
   - Check for unintended changes
   - Verify all tests pass

10. **Merge & Deploy**
    - Merge to main branch
    - Deploy to staging first
    - Monitor for issues

---

## Guardrails to Prevent Chaos

### Rule 1: One Issue, One Branch
**Problem:** Multiple issues being fixed simultaneously  
**Solution:** Create separate branches for each issue

```bash
# BAD
git checkout -b fix-everything

# GOOD  
git checkout -b fix/playlist-assignment-404
git checkout -b fix/realtime-service-startup
```

### Rule 2: Test Before Commit
**Problem:** Breaking changes merged without testing  
**Solution:** Run tests before every commit

```bash
# Add to pre-commit hook
pnpm test
pnpm build
```

### Rule 3: Small, Incremental Changes
**Problem:** Large changes that break everything  
**Solution:** Break work into small chunks

```
# BAD: One huge commit
- Changed 50 files
- Fixed 10 bugs
- Added 5 features

# GOOD: Multiple small commits
- Fix: Correct token extraction path
- Test: Add test for token extraction  
- Docs: Update auth flow documentation
```

### Rule 4: Always Have a Rollback Plan
**Problem:** Can't undo bad changes quickly  
**Solution:** Use version control, tags, and backups

```bash
# Tag working versions
git tag v1.0.0-working

# Easy rollback
git reset --hard v1.0.0-working
```

### Rule 5: Peer Review (or AI Review)
**Problem:** Missing obvious mistakes  
**Solution:** Always get a second pair of eyes

```
# Before merging
1. Review your own diff
2. Ask AI: "Review this change for issues"
3. Test in clean environment
```

---

## Proven Methods to Use

### 1. Test-Driven Development (TDD)
```typescript
// STEP 1: Write failing test
test('should assign playlist to display', async () => {
  const display = await createDisplay();
  const playlist = await createPlaylist();
  
  await displayService.assignPlaylist(display.id, playlist.id);
  
  const updated = await displayService.findOne(display.id);
  expect(updated.currentPlaylistId).toBe(playlist.id);
});

// STEP 2: Make it pass
// STEP 3: Refactor
```

**Benefits:**
- Catch regressions immediately
- Clearer requirements
- Confidence in changes

### 2. Feature Flags
```typescript
// Add feature flag for risky changes
const USE_NEW_PLAYLIST_ASSIGNMENT = 
  process.env.FEATURE_NEW_ASSIGNMENT === 'true';

if (USE_NEW_PLAYLIST_ASSIGNMENT) {
  // New implementation
} else {
  // Old (working) implementation
}
```

**Benefits:**
- Easy rollback
- A/B testing
- Gradual rollout

### 3. Defensive Programming
```typescript
// BAD: Assume data exists
const playlistId = dto.currentPlaylistId;

// GOOD: Validate everything
if (!dto.currentPlaylistId) {
  throw new BadRequestException('Playlist ID is required');
}

const playlist = await this.findPlaylist(dto.currentPlaylistId);
if (!playlist) {
  throw new NotFoundException('Playlist not found');
}

const playlistId = playlist.id; // Safe to use
```

### 4. Logging & Observability
```typescript
// Add comprehensive logging
this.logger.log(`Assigning playlist ${playlistId} to display ${displayId}`);
this.logger.debug(`User org: ${organizationId}`);
this.logger.debug(`Playlist org: ${playlist.organizationId}`);

if (playlist.organizationId !== organizationId) {
  this.logger.error(`Org mismatch! Expected ${organizationId}, got ${playlist.organizationId}`);
  throw new ForbiddenException('Playlist does not belong to your organization');
}

this.logger.log(`Assignment successful`);
```

### 5. Code Reviews with Checklists
```markdown
## Pre-Merge Checklist

- [ ] All tests pass
- [ ] No console.log statements left in code
- [ ] Updated relevant documentation
- [ ] Checked for performance impact
- [ ] Verified error handling
- [ ] Tested happy path
- [ ] Tested edge cases
- [ ] Tested error cases
- [ ] No hardcoded values
- [ ] Environment variables documented
```

---

## AI-Assisted Development Best Practices

### When Working with AI (like me!)

**DO:**
- ✅ Give clear, specific problem descriptions
- ✅ Share error messages and stack traces
- ✅ Ask for explanation before implementation
- ✅ Request review of AI-generated code
- ✅ Test AI suggestions before committing

**DON'T:**
- ❌ Accept code changes blindly
- ❌ Let AI make multiple changes without testing
- ❌ Skip code review because "AI wrote it"
- ❌ Assume AI understands full context
- ❌ Let AI "try things" without a plan

### AI Workflow Example
```
USER: "Playlist assignment returns 404"

AI: "Let me investigate..."
[AI analyzes code, logs, database]

AI: "Root cause: JWT organizationId extraction issue"

USER: "Show me the fix plan before coding"

AI: [Presents plan with affected files]

USER: "Approved. Proceed."

AI: [Makes changes]

USER: [Tests changes]

USER: "Works! Now explain what you changed."

AI: [Explains changes for documentation]
```

---

## Emergency Rollback Procedure

If something breaks in production:

1. **Stop the Bleeding**
   ```bash
   # Revert to last known good version
   git reset --hard <last-good-commit>
   # Or restore from backup
   ```

2. **Document the Issue**
   - What broke?
   - When did it break?
   - What was the last change?

3. **Root Cause Analysis**
   - Debug in isolation
   - Don't make changes under pressure
   - Create reproduction case

4. **Proper Fix**
   - Follow full workflow above
   - Test extensively before re-deploying

---

## Tools to Enforce Guardrails

### 1. Pre-commit Hooks (Husky)
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm test && pnpm lint",
      "pre-push": "pnpm build"
    }
  }
}
```

### 2. CI/CD Pipeline
```yaml
# .github/workflows/test.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
```

### 3. Linting & Formatting
```bash
# Auto-fix common issues
pnpm eslint --fix
pnpm prettier --write
```

### 4. Type Checking
```bash
# Catch type errors before runtime
pnpm tsc --noEmit
```

---

## Checklist for Next Development Session

Before making ANY code change:

- [ ] Is there a clear problem statement?
- [ ] Have I debugged to find root cause?
- [ ] Do I have a plan for the fix?
- [ ] Have I created a branch?
- [ ] Do I have a way to test the fix?
- [ ] Do I know how to rollback if it breaks?

After making code change:

- [ ] Did I test the change?
- [ ] Did I run the full test suite?
- [ ] Did I update documentation?
- [ ] Did I commit with a clear message?
- [ ] Can I explain what changed and why?

---

## Example: Today's Chaos vs. Proper Workflow

### What Happened Today (Chaos)
```
1. Make change to fix playlist assignment
2. Service crashes
3. Make another change to fix crash
4. Port conflict
5. Change ports
6. Original issue still not fixed
7. Multiple files changed
8. Lost track of what works
```

### What Should Have Happened (Proper Workflow)
```
1. Document issue: "Playlist assignment returns 404"
2. Debug: Add logging, check database directly
3. Root cause: Found JWT extraction issue
4. Plan: Fix token extraction in one place
5. Create branch: fix/playlist-assignment-404
6. Make atomic change
7. Test thoroughly
8. Document change
9. Merge
10. Move to next issue
```

---

## Summary

**Key Principles:**
1. **Understand before changing** - Debug, don't guess
2. **Plan before coding** - Design, then implement
3. **Test after every change** - Break early, not in production
4. **Document everything** - Future you will thank you
5. **Small, atomic changes** - Easy to understand and rollback

**Remember:** Good software development is about discipline, not speed. Taking 10 extra minutes to plan saves hours of debugging.
