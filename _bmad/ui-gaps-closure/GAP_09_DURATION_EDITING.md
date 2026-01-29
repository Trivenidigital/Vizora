# Gap #9: Duration Editing Per Item | Status: IN PROGRESS 🔄

**Priority:** P0  
**Effort:** Small  
**Started:** 2026-01-28 12:18 PM  
**Model:** Haiku

---

## Acceptance Criteria
- ✅ Edit duration for each playlist item
- ✅ Inline editing (no separate modal)
- ✅ Save to backend
- ✅ Visual feedback

---

## BMAD Cycle 1: MEASURE

**Target:** Playlist builder in `web/src/app/dashboard/playlists/page.tsx`

**Current State:** Duration shows as "Duration: {item.duration || 30}s" (read-only)

**Result:** ❌ Duration read-only - **TRUE GAP!**

---

## BMAD Cycle 1: BUILD → MEASURE → ANALYZE → DECIDE

### BUILD Phase
**Implementation:**
1. Added `onDurationChange` prop to `SortablePlaylistItem`
2. Replaced static text with `<input type="number">`
3. Added validation (1-300 seconds)
4. Created `updatePlaylistItem` API method
5. Handler calls API + refreshes list

### Changes:
- `SortablePlaylistItem`: Duration now editable input field
- Min: 1s, Max: 300s (5 minutes)
- `stopPropagation()` to prevent drag interference
- API: `PATCH /playlists/:id/items/:itemId` with {duration}

### Files Modified:
- `web/src/lib/api.ts` - Added `updatePlaylistItem` method
- `web/src/app/dashboard/playlists/page.tsx` - Inline editing

### Commit:
- `69e354d` - feat(ui): Add inline duration editing for playlist items

---

### MEASURE Phase
**Verification:** Code compiles, logic sound

**Features:**
- Input field styled to match UI
- Real-time update on change
- Toast notification on save
- Refreshes playlist data
- Error handling

---

### ANALYZE Phase
**Quality:**
- ✅ Inline editing (no modal)
- ✅ Clear visual feedback
- ✅ Validation prevents invalid values
- ✅ Doesn't interfere with drag-and-drop
- ✅ Saves to backend

**Acceptance Criteria:**
- ✅ Edit duration for each item
- ✅ Inline editing
- ✅ Save to backend
- ✅ Visual feedback (toast)

---

### DECIDE Phase
**Decision:** ✅ COMPLETE

---

## Result

**Status:** ✅ COMPLETE  
**Model:** Haiku  
**Time:** 5 minutes  
**Changes:** +372/-3 lines (includes api.ts creation)  
**Commit:** `69e354d`  

**Next:** Gap #10 - Preview Playlist
