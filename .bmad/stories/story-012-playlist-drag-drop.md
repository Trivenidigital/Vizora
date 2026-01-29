# Story 012: Playlist Item Ordering (Drag & Drop)

**ID:** STORY-012  
**Module:** Playlist Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** reorder playlist items by dragging  
**So that** I can easily adjust the playback sequence

---

## Acceptance Criteria

### AC-001: Drag Handle
- Visual drag handle (⋮⋮ icon)
- Cursor changes on hover
- Grab cursor while dragging

### AC-002: Drag Behavior
- Drag item to new position
- Visual feedback during drag
- Drop to reorder
- Order persists on save

### AC-003: Touch Support
- Works on touch devices
- Touch-and-hold to drag
- Smooth mobile experience

---

## Implementation

**Library:** @dnd-kit/core  
**Files:** `web/src/app/dashboard/playlists/page.tsx`

---

## Test Cases

See: `.bmad/testing/test-cases/story-012-tests.md`  
**Total:** 6 test cases

---

**Status:** ⏳ READY FOR TEST
