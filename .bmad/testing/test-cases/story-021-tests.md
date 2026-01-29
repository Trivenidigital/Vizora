# Test Cases: Story 021 - P0 Quick Wins UI Polish

**Story ID:** STORY-021  
**Created:** 2026-01-28  
**Test Environment:** Local Development  
**Tester:** Manual (User)

---

## Test Case Summary

**Total Cases:** 25  
**P0 Critical:** 18  
**P1 High:** 7  
**Estimated Time:** 90 minutes

---

## TC-021-001: Sortable Columns - Name

**Priority:** P0  
**Pre-conditions:**
- Logged into Vizora
- At least 5 devices exist with different names

**Test Steps:**
1. Navigate to `/dashboard/devices`
2. Observe initial device order
3. Click "Device" column header
4. Observe devices reorder alphabetically (A-Z)
5. Click "Device" column header again
6. Observe devices reorder reverse alphabetically (Z-A)

**Expected Result:**
- First click: Sort ascending, show ↑ arrow
- Second click: Sort descending, show ↓ arrow
- Third click: Clear sort, no arrow

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-001.png`

---

## TC-021-002: Sortable Columns - Status

**Priority:** P0  
**Pre-conditions:**
- At least 3 devices: 1 online, 2 offline

**Test Steps:**
1. Navigate to `/dashboard/devices`
2. Click "Status" column header
3. Verify online devices appear first
4. Click again
5. Verify offline devices appear first

**Expected Result:**
- Sorts by status (online/offline)
- Visual indicator shows sort direction

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-002.png`

---

## TC-021-003: Pagination - Items Per Page

**Priority:** P0  
**Pre-conditions:**
- At least 30 devices exist

**Test Steps:**
1. Navigate to `/dashboard/devices`
2. Verify default shows 10 items
3. Click "Items per page" dropdown
4. Select "25 per page"
5. Verify 25 items display
6. Select "50 per page"
7. Verify 50 items display (if available)

**Expected Result:**
- Dropdown shows options: 10/25/50/100
- Page updates immediately on selection
- Shows correct count: "Showing 1 to X of Y devices"

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-003.png`

---

## TC-021-004: Pagination - Navigate Pages

**Priority:** P0  
**Pre-conditions:**
- At least 30 devices exist
- Items per page set to 10

**Test Steps:**
1. Verify on page 1
2. Click "Next" button
3. Verify on page 2, showing items 11-20
4. Click "Previous" button
5. Verify back on page 1
6. Click page number "3" directly
7. Verify on page 3, showing items 21-30

**Expected Result:**
- Previous disabled on page 1
- Next disabled on last page
- Current page highlighted
- Correct items display for each page

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-004.png`

---

## TC-021-005: Inline Validation - Login Email

**Priority:** P0  
**Pre-conditions:**
- Logged out
- On login page

**Test Steps:**
1. Navigate to `/login`
2. Leave email empty, enter password
3. Click "Login" button
4. Verify error below email field: "Email is required"
5. Enter invalid email "test"
6. Click "Login"
7. Verify error: "Please enter a valid email address"
8. Enter valid email
9. Tab to next field
10. Verify error disappears

**Expected Result:**
- Errors show on submit (not while typing)
- Errors are red, below the field
- Errors clear on blur when fixed
- Toast notification does not duplicate error

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-005.png`

---

## TC-021-006: Inline Validation - Content Upload

**Priority:** P0  
**Pre-conditions:**
- Logged in
- On content page

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Upload Content"
3. Leave title empty
4. Click "Upload"
5. Verify error below title: "Title is required"
6. Enter title
7. Tab away
8. Verify error clears

**Expected Result:**
- Field-level errors display
- Errors clear on blur when fixed
- Multiple errors show simultaneously

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-006.png`

---

## TC-021-007: Currently Playing - With Playlist

**Priority:** P0  
**Pre-conditions:**
- Device paired
- Playlist assigned to device

**Test Steps:**
1. Navigate to `/dashboard/devices`
2. Locate device with assigned playlist
3. Check "Currently Playing" column
4. Verify playlist name displays

**Expected Result:**
- Shows playlist name
- Displays as badge with icon 📋
- Blue background color

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-007.png`

---

## TC-021-008: Currently Playing - No Playlist

**Priority:** P0  
**Pre-conditions:**
- Device paired
- No playlist assigned

**Test Steps:**
1. Navigate to `/dashboard/devices`
2. Locate device without playlist
3. Check "Currently Playing" column
4. Verify shows "No playlist"

**Expected Result:**
- Shows "No playlist" in gray italic text

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-008.png`

---

## TC-021-009: Thumbnail Generation - Image Upload

**Priority:** P0  
**Pre-conditions:**
- Logged in
- Have test image (JPEG, <5MB)

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Upload Content"
3. Select "Image" type
4. Choose test image
5. Enter title
6. Click "Upload"
7. Wait for success message
8. Refresh page
9. Locate uploaded content
10. Verify thumbnail displays (not just emoji)

**Expected Result:**
- Upload succeeds
- Thumbnail generated automatically
- Thumbnail displays in grid (not 🖼️ emoji)
- Thumbnail is 300x300px max

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-009.png`

---

## TC-021-010: Thumbnail Generation - File Size Limit

**Priority:** P0 - Security  
**Pre-conditions:**
- Have test image >50MB

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Upload Content"
3. Select "Image" type
4. Choose image >50MB
5. Enter title
6. Click "Upload"
7. Verify error or warning

**Expected Result:**
- Upload rejected OR thumbnail generation skipped
- Error message mentions file size limit
- Console shows warning (check DevTools)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-010.png`

---

## TC-021-011: Preview Modal - Image

**Priority:** P0  
**Pre-conditions:**
- At least one image content item exists

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Preview" button on image item
3. Verify modal opens
4. Verify image displays full-size
5. Click image to zoom
6. Verify zoom toggle works
7. Press ESC key
8. Verify modal closes

**Expected Result:**
- Modal opens with image
- Image scales to fit (max-h-[80vh])
- Click toggles zoom (scale-150 class)
- ESC closes modal

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-011.png`

---

## TC-021-012: Preview Modal - Video

**Priority:** P0  
**Pre-conditions:**
- At least one video content item exists

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Preview" on video item
3. Verify modal opens with video player
4. Verify video controls present (play/pause/volume)
5. Click play
6. Verify video plays
7. Close modal

**Expected Result:**
- Video player with native controls
- Preload set to "metadata" (not auto-play)
- Video responsive (w-full)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-012.png`

---

## TC-021-013: Preview Modal - PDF

**Priority:** P0  
**Pre-conditions:**
- At least one PDF content item exists

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Preview" on PDF item
3. Verify modal opens with PDF viewer
4. Verify PDF displays in iframe
5. Check DevTools console for security warnings
6. Verify sandbox attribute present

**Expected Result:**
- PDF embedded in iframe
- Sandbox attribute: "allow-scripts allow-same-origin"
- No XSS warnings in console
- Height: 80vh

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-013.png`

---

## TC-021-014: Preview Modal - URL

**Priority:** P1  
**Pre-conditions:**
- At least one URL content item exists

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Preview" on URL item
3. Verify modal shows external link
4. Click link
5. Verify opens in new tab
6. Check link has rel="noopener noreferrer"

**Expected Result:**
- Shows URL as clickable link
- Opens in new tab (target="_blank")
- Has noopener noreferrer (security)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-014.png`

---

## TC-021-015: Visual Playlist Thumbnails - With Content

**Priority:** P0  
**Pre-conditions:**
- Playlist exists with 4+ content items
- Content items have thumbnails

**Test Steps:**
1. Navigate to `/dashboard/playlists`
2. Locate playlist with content
3. Verify visual thumbnail grid (2x2)
4. Verify shows first 4 content items
5. Verify grid is 20x20 size
6. Check lazy loading (Network tab)

**Expected Result:**
- 2x2 grid displays
- Shows first 4 thumbnails
- Lazy loading attribute present
- Grid rounded with overflow hidden

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-015.png`

---

## TC-021-016: Visual Playlist Thumbnails - Fallback

**Priority:** P1  
**Pre-conditions:**
- Empty playlist OR playlist with no thumbnails

**Test Steps:**
1. Navigate to `/dashboard/playlists`
2. Locate playlist without content/thumbnails
3. Verify emoji fallback displays (📋)
4. Verify emoji centered in 20x20 square

**Expected Result:**
- Shows 📋 emoji
- Centered, text-4xl size
- Gray background (bg-gray-100)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-016.png`

---

## TC-021-017: Visual Thumbnails - Performance

**Priority:** P1  
**Pre-conditions:**
- 20+ playlists with content

**Test Steps:**
1. Navigate to `/dashboard/playlists`
2. Open DevTools Network tab
3. Scroll down slowly
4. Verify images load progressively
5. Check for `loading="lazy"` attribute
6. Verify not all images load immediately

**Expected Result:**
- Images load as they enter viewport
- lazy loading attribute present
- Network tab shows staggered requests
- No performance degradation

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-017.png`

---

## TC-021-018: Duration Editing - Inline Edit

**Priority:** P0  
**Pre-conditions:**
- Playlist with items

**Test Steps:**
1. Navigate to `/dashboard/playlists`
2. Click "Edit" on playlist
3. Locate duration input for item
4. Change duration from 30 to 60
5. Click outside input
6. Click "Save"
7. Reload page
8. Edit playlist again
9. Verify duration is 60

**Expected Result:**
- Duration input editable inline
- Value saves to backend
- Persists after reload

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-018.png`

---

## TC-021-019: Drag-Drop Reordering

**Priority:** P0  
**Pre-conditions:**
- Playlist with 3+ items

**Test Steps:**
1. Navigate to `/dashboard/playlists`
2. Click "Edit" on playlist
3. Note current item order
4. Drag item #3 to position #1
5. Verify visual reorder immediate
6. Click "Save"
7. Reload page
8. Edit playlist again
9. Verify order persisted

**Expected Result:**
- Drag handle visible
- Drag-drop works smoothly
- Visual feedback during drag
- Order saves to backend

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-019.png`

---

## TC-021-020: Edit Content - Save Changes

**Priority:** P0  
**Pre-conditions:**
- Content item exists

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Click "Edit" on content item
3. Change title
4. Click "Save"
5. Verify success message
6. Reload page
7. Verify title changed

**Expected Result:**
- Edit modal opens
- Changes save to backend
- Success toast shows
- Changes persist

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-020.png`

---

## TC-021-021: Responsive - Tablet View

**Priority:** P1  
**Pre-conditions:**
- Browser dev tools available

**Test Steps:**
1. Open DevTools
2. Set viewport to 768px width
3. Navigate to `/dashboard/devices`
4. Verify table responsive
5. Check pagination controls
6. Navigate to `/dashboard/content`
7. Verify grid adjusts

**Expected Result:**
- Table stacks gracefully
- Pagination controls visible
- Content grid adjusts columns
- No horizontal scroll

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-021.png`

---

## TC-021-022: Responsive - Mobile View

**Priority:** P1  
**Pre-conditions:**
- Browser dev tools available

**Test Steps:**
1. Set viewport to 375px width
2. Navigate through all pages
3. Verify mobile layout
4. Check modals fit screen
5. Test mobile navigation

**Expected Result:**
- All content fits viewport
- Modals are mobile-friendly
- Touch targets adequate size
- No overlapping UI

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-022.png`

---

## TC-021-023: Error Handling - Network Failure

**Priority:** P1  
**Pre-conditions:**
- Chrome DevTools

**Test Steps:**
1. Navigate to `/dashboard/content`
2. Open DevTools Network tab
3. Set throttling to "Offline"
4. Try to upload content
5. Verify error handling
6. Restore network
7. Verify recovery

**Expected Result:**
- Error message displays
- UI doesn't crash
- Retry mechanism works
- Toast shows clear error

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-023.png`

---

## TC-021-024: Console Errors Check

**Priority:** P0  
**Pre-conditions:**
- Fresh browser session

**Test Steps:**
1. Open DevTools Console
2. Navigate to all pages
3. Trigger all features
4. Check for errors/warnings
5. Document any console output

**Expected Result:**
- No errors in console
- Only expected warnings (if any)
- No memory leaks
- No failed network requests (except intentional)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-024.txt` (console log)

---

## TC-021-025: Cross-Browser - Firefox

**Priority:** P2  
**Pre-conditions:**
- Firefox installed

**Test Steps:**
1. Open Vizora in Firefox
2. Run smoke test of all features:
   - Login
   - Sort/pagination
   - Upload content
   - Preview modal
   - Visual thumbnails
3. Note any differences

**Expected Result:**
- All features work in Firefox
- No major visual differences
- No console errors

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-021/TC-021-025-firefox.png`

---

## Test Execution Log

| TC ID | Date | Time | Status | Tester | Notes |
|-------|------|------|--------|--------|-------|
| TC-021-001 | - | - | ⏳ | - | - |
| TC-021-002 | - | - | ⏳ | - | - |
| ... | - | - | ⏳ | - | - |

---

## Summary

**Total:** 25 test cases  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0  
**Not Run:** 25

**Estimated Time:** 90 minutes  
**Actual Time:** TBD

---

**Next Step:** Execute tests and capture evidence
