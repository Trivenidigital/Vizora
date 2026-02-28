# Plan Generator

## Plan Template

Generate plans in this exact format:

```markdown
## Support Request Plan

### Summary
One paragraph describing what will be changed and why.

### Classification
- **Type:** bug-fix | feature-request | config-change | ui-tweak | content-update
- **Component:** <component name>
- **Urgency:** high | medium | low

### Files to Modify
| # | File | Lines | Change Description |
|---|------|-------|--------------------|
| 1 | path/to/file.ts | L45-60 | What changes and why |

### Files to Create
| # | File | Purpose |
|---|------|---------|
| 1 | path/to/new-file.ts | Why this file is needed |

(Omit section if no new files needed)

### Tests
- [ ] Existing test: `path/to/test.spec.ts` — should still pass
- [ ] New test: `describe what to test`

### Risk Assessment
**Level:** Low | Medium | High

**Justification:** Why this risk level (single file cosmetic = low, multi-file logic = medium, auth/data/infra = high)

**Rollback:** How to revert if something goes wrong

### Estimated Scope
- **Files changed:** N
- **Lines affected:** ~N
- **Complexity:** Simple (1 concept) | Moderate (2-3 concepts) | Complex (4+ concepts)
```

## Risk Assessment Criteria

| Level | Criteria |
|-------|----------|
| **Low** | Single file, cosmetic/text change, no logic change, existing tests cover it |
| **Medium** | 2-5 files, logic changes, may need new tests, no auth/data impact |
| **High** | 6+ files, auth/security/data migration, infrastructure, breaking API changes |

## Plan Rules

1. Every modified file must have a specific line range and change description
2. Never propose changes without identifying affected tests
3. If risk is High, add a "Mitigation Steps" subsection
4. Plan must be human-reviewable — descriptions of changes, not code
5. Keep plan under 50 lines for Low risk, under 100 for Medium/High
