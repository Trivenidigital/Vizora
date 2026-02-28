# Report Format Reference

Defines the output format for the Vizora deployment readiness report.

## Readiness Levels

| Level | Icon | Criteria | Deployment Guidance |
|-------|------|----------|---------------------|
| **READY** | [PASS] | 0 critical issues, 0 warnings | Safe to deploy. Content will display correctly. |
| **DEGRADED** | [WARN] | 0 critical issues, 1+ warnings | Deploy at discretion. Review warnings — content works but may have suboptimal behavior. |
| **NOT READY** | [FAIL] | 1+ critical issues | **Do not deploy.** Critical issues will cause visible failures on customer displays. |

## Report Structure

```markdown
# Vizora Deployment Readiness Report

**Status: [PASS/WARN/FAIL] READY/DEGRADED/NOT READY**

Generated: 2026-02-27T10:30:00.000Z

## Summary

| Metric | Count |
|--------|-------|
| Critical issues | 0 |
| Warnings | 3 |
| Info | 5 |
| Categories checked | 3 |
| Total scan time | 1250ms |

## Content (2 issues)

### [~] Warning (1)

- **C-002**: Content expired on 2026-01-15 but still active
  - Entity: Holiday Banner (`abc-123`)
  - Fix: Archive expired content or extend expiration date.

### [i] Info (1)

- **C-003**: Content not assigned to any playlist
  - Entity: Old Logo (`def-456`)
  - Fix: Add to a playlist or archive if no longer needed.

**Stats:**
- totalContent: 45
- totalPlaylists: 12
- orphanedContent: 1

## Display — No issues found

## Schedule (1 issue)

### [~] Warning (1)

- **S-003**: Schedule ended on 2026-01-01 but is still active
  - Entity: New Year Schedule (`ghi-789`)
  - Fix: Deactivate or delete the expired schedule.

## Readiness Decision

No critical issues found, but warnings should be reviewed before deployment.
Content will work but may have suboptimal behavior on some displays.
```

## JSON Output Schema

The report generator outputs JSON with this structure:

```typescript
interface AggregatedReport {
  readiness: 'READY' | 'DEGRADED' | 'NOT READY';
  timestamp: string;                    // ISO 8601
  summary: {
    totalIssues: number;
    critical: number;
    warning: number;
    info: number;
    categoriesChecked: string[];        // e.g., ['content', 'display', 'schedule']
    totalDurationMs: number;
  };
  categories: ValidationResult[];       // One per validator script
  markdown: string;                     // Pre-rendered markdown report
}
```

## Severity Icons

Used in markdown output for quick visual scanning:

| Severity | Icon | Meaning |
|----------|------|---------|
| Critical | `[!]` | Must fix before deploy |
| Warning | `[~]` | Review recommended |
| Info | `[i]` | Housekeeping item |

## Audience

Reports are designed to be readable by:
- **Developers**: Full technical detail, entity IDs, rule codes
- **Content managers**: Clear plain-English descriptions and fix recommendations
- **Operations**: Summary table for quick go/no-go decisions

Avoid jargon in the `message` and `recommendation` fields. Use terms like "display will show nothing" instead of "null pointer in content resolver."
