# Test Cases: Story 014 - Visual Playlist Thumbnails

**Story ID:** STORY-014 | **Priority:** P0 | **Time:** 20 min | **Cases:** 6

**Note:** Fully covered in Story-021 (TC-021-015, TC-021-016, TC-021-017)

---

## TC-014-001: 2x2 Thumbnail Grid
**Steps:** 1) View playlists page 2) Check playlist cards  
**Expected:** 2x2 grid showing first 4 content thumbnails  
**Evidence:** `.bmad/testing/evidence/story-014/TC-014-001.png`

## TC-014-002: Grid Size
**Steps:** 1) Inspect thumbnail grid element  
**Expected:** 80x80px total (each thumb ~40x40px)  
**Evidence:** `.bmad/testing/evidence/story-014/TC-014-002.png`

## TC-014-003: Lazy Loading
**Steps:** 1) Open DevTools Network 2) Scroll playlists page  
**Expected:** loading="lazy" attribute, images load on scroll  
**Evidence:** `.bmad/testing/evidence/story-014/TC-014-003.png`

## TC-014-004: Emoji Fallback - Empty Playlist
**Steps:** 1) View empty playlist (0 items)  
**Expected:** 📋 emoji shown instead of grid  
**Evidence:** `.bmad/testing/evidence/story-014/TC-014-004.png`

## TC-014-005: Partial Grid (<4 items)
**Steps:** 1) View playlist with 2 items  
**Expected:** Shows 2 thumbnails in grid, others empty  
**Evidence:** `.bmad/testing/evidence/story-014/TC-014-005.png`

## TC-014-006: Broken Image Handling
**Steps:** 1) Playlist with missing/broken thumbnail  
**Expected:** Placeholder or fallback for broken image  
**Evidence:** `.bmad/testing/evidence/story-014/TC-014-006.png`

---

**Summary:** 6 cases | 0 passed | 6 not run | Est: 20 min
