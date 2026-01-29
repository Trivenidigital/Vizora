# Gap #6: Currently Playing Indicator (Playlists) | Status: IN PROGRESS 🔄

**Priority:** P0  
**Effort:** Medium  
**Started:** 2026-01-28 11:47 AM  
**Model:** Haiku

---

## Acceptance Criteria
- ✅ Show which playlists are currently active
- ✅ Display count of devices using this playlist
- ✅ Visual indicator (badge/label)
- ✅ Link to devices using it (optional)

---

## BMAD Cycle 1: MEASURE (Discovery)

**Target:** `web/src/app/dashboard/playlists/page.tsx`

**Result:** ❌ Devices not loaded, no count shown - **TRUE GAP!**

---

## BMAD Cycle 1: BUILD → MEASURE → ANALYZE → DECIDE

### BUILD Phase
**Implementation:**
1. Added `devices` state
2. Created `loadDevices()` function
3. Created `getDeviceCount(playlistId)` helper
4. Updated UI to show device count badge

### Changes Made:
- Load devices on page mount
- Count devices where `currentPlaylistId === playlist.id`
- Display blue badge with 📺 icon + count
- Show only when count > 0
- Badge appears next to "Active" badge

### Files Modified:
- `web/src/app/dashboard/playlists/page.tsx` (+28/-5 lines)

### Commit:
- `20dbc7e` - feat(ui): Show currently playing device count on playlist cards

---

### MEASURE Phase
**Verification:** Code compiles, logic is sound

**Display Logic:**
- Badge only shows when `getDeviceCount(playlistId) > 0`
- Shows singular "1 device" or plural "N devices"
- Blue badge to distinguish from green "Active" badge

---

### ANALYZE Phase
**Quality Assessment:**
- ✅ Efficient (filter devices once per render)
- ✅ Clear visual indicator
- ✅ Matches existing badge pattern
- ✅ No breaking changes

**Acceptance Criteria:**
- ✅ Show which playlists are currently active (device count)
- ✅ Display count of devices using playlist
- ✅ Visual indicator (blue badge)
- ⚠️ Link to devices (deferred - would require routing)

---

### DECIDE Phase
**Decision:** ✅ COMPLETE

**Status:** Feature implemented and committed

---

## Result

**Status:** ✅ COMPLETE  
**Model:** Haiku  
**Time:** 5 minutes  
**Changes:** +28/-5 lines  
**Commit:** `20dbc7e`  

**Next:** Gap #7 - Currently Playing (Devices)
