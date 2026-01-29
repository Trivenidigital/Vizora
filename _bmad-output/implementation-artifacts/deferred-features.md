---
title: Deferred Features Log
created: 2026-01-28
status: tracking
---

# Deferred Features - To Revisit Later

This document tracks features that were identified but deferred for future implementation.

---

## Notifications Dropdown (P1 Feature)

**Deferred On:** 2026-01-28  
**Reason:** User decision to revisit later  
**Status:** 🟡 Deferred

### Original Scope (from UI Gap Analysis):
- Real-time notification system in header
- Alert types: device status changes, content processing, system alerts, scheduled events
- Dropdown UI component in dashboard header
- Mark as read/unread functionality
- Persistence in database

### Questions to Answer When Resuming:
1. Should notifications be real-time events OR based on audit logs? Or both?
2. What notification types are needed (device status, content processing, system alerts, scheduled events)?
3. Should notifications be dismissible and persist (mark as read in DB) or ephemeral (show once)?

### Technical Notes:
- Existing `AuditLog` table could be leveraged for activity-based notifications
- WebSocket infrastructure already exists for real-time updates
- Would need new `Notification` table with fields: type, message, read status, timestamp, userId

### References:
- UI Gap Analysis: `C:\Projects\vizora\vizora\ClawdBot\UI_GAP_ANALYSIS_IMPLEMENTED_FEATURES.md` (Section 5.1)
- Priority: P1 (High Priority)
- Effort: Medium (M)

---

## Folder Organization (P1 Feature)

**Deferred On:** 2026-01-28  
**Reason:** User decision to revisit later  
**Status:** 🟡 Deferred

### Original Scope (from UI Gap Analysis):
- Hierarchical folder structure for content organization
- Replace flat content list with folder tree navigation
- Folder CRUD operations (create, rename, delete, move)
- Content assignment to folders
- Breadcrumb navigation within folders

### Questions to Answer When Resuming:
1. Hierarchical folders (nested: Marketing/Summer2024/Promo) OR flat folders (one level)?
2. Exclusive folders (content in ONE folder) OR taggable (content in multiple folders via tags)?
3. Reuse existing Tag system as "Folders" in UI OR create separate Folder table with parent-child?

### Technical Notes:
- Existing `Tag` and `ContentTag` tables could support folder-like behavior
- Alternative: New `Folder` table with `parentFolderId` for hierarchy
- Content table would need `folderId` field (or continue using tags)
- UI already has search/filter infrastructure to build upon

### References:
- UI Gap Analysis: `C:\Projects\vizora\vizora\ClawdBot\UI_GAP_ANALYSIS_IMPLEMENTED_FEATURES.md` (Section 1.1)
- Priority: P1 (High Priority)
- Effort: Large (L)

---

## Resume Instructions

When ready to implement either feature:

1. Read this document to recall context
2. Review the "Questions to Answer When Resuming" section
3. Run `/quick-spec` with the feature name
4. Reference the UI Gap Analysis for detailed requirements
5. Update this document with new status

---

**Next Review:** When P0 features complete and ready for P1 work
