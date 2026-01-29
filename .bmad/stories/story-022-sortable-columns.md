# Story 022: Sortable Table Columns

**ID:** STORY-022  
**Module:** UI/UX Enhancements  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** sort table columns  
**So that** I can organize data the way I need

---

## Acceptance Criteria

### AC-001: Sort Indicators
- Click column header to sort
- Visual indicator: ↑ (ascending) or ↓ (descending)
- Third click clears sort

### AC-002: Sortable Columns
**Devices Page:**
- Device name
- Status (online/offline)
- Location
- Last seen

**Content Page:**
- Title
- Type
- Size
- Upload date

### AC-003: Sort Behavior
- Ascending on first click
- Descending on second click
- Clear on third click
- Sort persists during session

---

## Implementation

**Files:** `web/src/app/dashboard/devices/page.tsx`  
**Method:** Client-side sorting  
**Already Working:** Yes (verified existing)

---

## Test Cases

See: `.bmad/testing/test-cases/story-022-tests.md`  
**Total:** 8 test cases

---

**Status:** ⏳ READY FOR TEST
