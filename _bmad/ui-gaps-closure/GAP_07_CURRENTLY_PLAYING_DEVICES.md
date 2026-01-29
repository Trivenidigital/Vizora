# Gap #7: Currently Playing (Devices) | Status: IN PROGRESS 🔄

**Priority:** P0  
**Effort:** Medium  
**Started:** 2026-01-28 11:53 AM  
**Model:** Haiku

---

## Acceptance Criteria
- ✅ Show which playlist is currently playing on each device
- ✅ Display in device list/table
- ✅ Visual indicator or column

---

## BMAD Cycle 1: MEASURE

**Target:** `web/src/app/dashboard/devices/page.tsx`

**Result:** ❌ No "currently playing" info shown - **TRUE GAP!**

---

## BMAD Cycle 1: BUILD → MEASURE → ANALYZE → DECIDE

### BUILD Phase
**Implementation:**
1. Added `playlists` state
2. Created `loadPlaylists()` function  
3. Created `getCurrentPlaylistName(playlistId)` helper
4. Added "Currently Playing" column to table
5. Show playlist name badge or "No playlist"

### Changes Made:
- Load playlists on page mount
- Look up playlist by `device.currentPlaylistId`
- Display blue badge with 📋 icon + name
- Show "No playlist" if not assigned
- New column between Location and Last Seen

### Files Modified:
- `web/src/app/dashboard/devices/page.tsx` (+30 lines)

### Commit:
- `f4c1d4f` - feat(ui): Add currently playing playlist column to devices table

---

### MEASURE Phase
**Verification:** Code compiles, logic is sound

**Display Logic:**
- Shows playlist name if `currentPlaylistId` exists
- Shows "No playlist" (italic gray) if not assigned
- Blue badge matches playlist page styling

---

### ANALYZE Phase
**Quality:**
- ✅ Consistent badge styling
- ✅ Handles missing data gracefully
- ✅ No performance issues (simple lookup)
- ✅ Mobile-responsive (whitespace-nowrap)

**Acceptance Criteria:**
- ✅ Show which playlist is currently playing
- ✅ Display in device table
- ✅ Visual indicator (badge)

---

### DECIDE Phase
**Decision:** ✅ COMPLETE

---

## Result

**Status:** ✅ COMPLETE  
**Model:** Haiku  
**Time:** 4 minutes  
**Changes:** +30 lines  
**Commit:** `f4c1d4f`  

**Next:** Gap #8 - Drag-and-drop playlist reordering
