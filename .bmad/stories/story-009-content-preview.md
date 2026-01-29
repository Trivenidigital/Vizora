# Story 009: Content Preview

**ID:** STORY-009  
**Module:** Content Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** preview content before using it  
**So that** I can verify it looks correct

---

## Acceptance Criteria

### AC-001: Preview Image
- Full-size image display
- Click to zoom (toggle)
- Max height: 80vh

### AC-002: Preview Video
- Video player with controls
- Play/pause, volume, seek
- Preload: metadata (not auto-play)

### AC-003: Preview PDF
- Embedded PDF viewer
- Sandboxed iframe (security)
- Scroll to view pages

### AC-004: Preview URL
- Show clickable link
- Open in new tab
- rel="noopener noreferrer" (security)

### AC-005: Modal Controls
- ESC key to close
- Click outside to close
- Close button (X)

---

## Implementation

**File:** `web/src/components/PreviewModal.tsx`  
**Security:** Sandbox on PDFs, noopener on URLs

---

## Test Cases

See: `.bmad/testing/test-cases/story-009-tests.md`  
**Total:** 10 test cases

---

**Status:** ⏳ READY FOR TEST
