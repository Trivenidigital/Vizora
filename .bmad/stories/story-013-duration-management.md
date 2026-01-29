# Story 013: Playlist Duration Management

**ID:** STORY-013  
**Module:** Playlist Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** set custom duration for each playlist item  
**So that** I can control how long each piece of content displays

---

## Acceptance Criteria

### AC-001: Inline Duration Editing
- Duration input next to each item
- Default: 30 seconds
- Range: 1-300 seconds
- Immediate validation

### AC-002: Duration Display
- Show duration in seconds
- Format: "30s", "120s"
- Total playlist duration calculated

### AC-003: Validation
- Min: 1 second
- Max: 300 seconds (5 minutes)
- Integer only
- Show error for invalid values

---

## Implementation

**Files:** `web/src/app/dashboard/playlists/page.tsx`

---

## Test Cases

See: `.bmad/testing/test-cases/story-013-tests.md`  
**Total:** 6 test cases

---

**Status:** ⏳ READY FOR TEST
