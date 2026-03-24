# Vizora Content Lifecycle Test Report

**Date:** 2026-03-24
**Tester:** Claude (Playwright MCP + API)
**Environment:** https://vizora.cloud (production)

---

## Summary

| Section | Tests | Passed | Failed | Bugs Found | Bugs Fixed |
|---------|-------|--------|--------|------------|------------|
| 1. Content Upload | 3 | 3 | 0 | 0 | 0 |
| 2. Playlists | 5 | 5 | 0 | 1 | 1 |
| 3. Schedules | 1 | 1 | 0 | 0 | 0 |
| 4-6. Streaming/Pairing/Analytics | — | — | — | — | — |
| **TOTAL** | **9** | **9** | **0** | **1** | **1** |

**Note:** Sections 4-6 require a physical display device or emulator for streaming/pairing tests. These cannot be tested via Playwright browser alone.

---

## Bug Found & Fixed

### BUG: `POST /api/v1/playlists/{id}/items` returns 400 Bad Request

**Severity:** Critical (blocks core workflow)
**Root Cause:** `AddPlaylistItemDto` used `@IsUUID('4')` validator on `contentId`, but content IDs use CUID format (e.g., `cmn5533kc003un9q19jzi6825`), not UUID v4.
**File:** `middleware/src/modules/playlists/dto/add-playlist-item.dto.ts`
**Fix:** Changed `@IsUUID('4')` to `@IsString()` — CUID content IDs now pass validation.
**Commit:** `432c876`
**Deployed:** Yes, PM2 reloaded both middleware instances.
**Verified:** Drag-and-drop to playlist now works — "Item added to playlist" toast, items appear with correct metadata.

---

## Section 1: Content Upload & Management

### Test 1.1: Upload Modal — PASS
- Upload modal opens with: Content Title, Content Type dropdown (Image/Video/PDF/URL), drag-and-drop zone
- File format/size hints shown: "PNG, JPG, GIF up to 10MB"
- Upload button disabled until file selected

### Test 1.2: Image Upload — PASS
- Uploaded `test-upload-image.jpg` (337 bytes JPEG)
- Upload queue showed file name, size (0.3 KB), status (Pending)
- Upload completed: item count 5 → 6
- New item appears at top of grid with thumbnail, type badge (IMAGE), duration (10s), upload date (3/24/2026)
- Status badge: "active"

### Test 1.3: Content Library Features — PASS
- Grid/List view toggle works
- Type filters: All, Image, Video, Pdf, Url
- Tags and Filters buttons
- Folder sidebar with "New Folder" button
- Per-card actions: Flag, Push, Playlist, Edit, Delete
- Bulk selection checkboxes
- Real-time sync indicator (green dot)

---

## Section 2: Playlist Creation & Management

### Test 2.1: Create Playlist — PASS
- Create Playlist modal: name + optional description
- Created "Test Restaurant Playlist" with description
- Success toast: "Playlist created successfully"
- Playlist appears in list with: name, description, 0 items, 0s duration
- Actions: Preview, Edit, Publish, Duplicate, Delete

### Test 2.2: Playlist Editor — PASS (after bug fix)
- Editor has 3-panel layout: Content Library | Playlist Items | Preview
- Drag-and-drop from Content Library to Playlist Items
- Initially returned 400 Bad Request → **fixed `@IsUUID` → `@IsString`**
- After fix: items added successfully with "Item added to playlist" toast
- 3 items added: image (30s), template (30s), template (30s)
- Total: "3 items", "1m 30s total"

### Test 2.3: Playlist Preview — PASS
- Live preview auto-cycles through items
- Progress bar with percentage (0% → 100%)
- Countdown timer per item ("30s remaining", "2s remaining")
- Previous/Pause/Next playback controls
- Item indicator: "2 of 3"

### Test 2.4: Duration Editing — PASS
- Each item has editable duration spinner (default 30s)
- Accepts numeric input

### Test 2.5: Loop Toggle — PASS
- Loop toggle ON by default (green switch)
- Save persists playlist state: "Playlist saved successfully"

---

## Section 3: Schedules

### Test 3.1: Schedule Page — PASS
- Create Schedule button
- List/Calendar view toggle
- Empty state with icon + message + CTA
- 0 total shown correctly

---

## Sections 4-6: Not Testable via Browser

These sections require:
- **Section 4 (Streaming):** A physical display device or Electron/Android TV emulator connected via WebSocket
- **Section 5 (Pairing):** A display client running pairing flow
- **Section 6 (Analytics):** Content impressions only logged when a device renders content

These must be tested with the Vizora display client (Electron desktop app or vizora-tv Android app).

---

## Screenshots

| File | Description |
|------|-------------|
| 24-upload-modal.png | Content upload modal |
| 25-upload-success.png | Content library after successful upload |
| 26-playlist-created.png | Playlist list with new playlist |
| 27-playlist-editor.png | Playlist editor (3-panel layout, before fix) |
| 28-playlist-3-items.png | Playlist editor with 3 items, live preview |
