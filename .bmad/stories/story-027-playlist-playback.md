# Story 027: Display App Playlist Playback

**ID:** STORY-027  
**Module:** Display Application  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** display device  
**I want to** play playlists automatically  
**So that** content cycles according to schedule

---

## Acceptance Criteria

### AC-001: Playlist Loading
- Receive playlist via WebSocket
- Load all content items
- Prepare for playback

### AC-002: Sequential Playback
- Play items in order
- Respect duration settings
- Smooth transitions between items
- Loop playlist when complete

### AC-003: Dynamic Updates
- Receive playlist updates
- Switch to new playlist
- Continue from current item or restart

### AC-004: Error Handling
- Skip failed content
- Log errors
- Continue playback

---

## Implementation

**Files:**
- `display/src/services/playlist.service.ts`
- `display/src/components/PlaylistPlayer.tsx`

---

## Test Cases

See: `.bmad/testing/test-cases/story-027-tests.md`  
**Total:** 10 test cases

---

**Status:** ⏳ READY FOR TEST
