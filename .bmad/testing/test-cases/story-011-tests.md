# Test Cases: Story 011 - Playlist Creation & Editing

**Story ID:** STORY-011 | **Priority:** P0 | **Time:** 35 min | **Cases:** 12

---

## TC-011-001: Create Playlist Button
**Steps:** 1) Navigate to playlists page 2) Click "Create Playlist"  
**Expected:** Create modal opens  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-001.png`

## TC-011-002: Playlist Name Input
**Steps:** 1) Enter name: "Morning Promotions"  
**Expected:** Name accepted, no error  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-002.png`

## TC-011-003: Playlist Description (Optional)
**Steps:** 1) Enter description 2) Save  
**Expected:** Description saved  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-003.png`

## TC-011-004: Add Content to Playlist
**Steps:** 1) Click "Add Content" 2) Select 3 items 3) Add  
**Expected:** All 3 items appear in playlist  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-004.png`

## TC-011-005: Set Item Duration
**Steps:** 1) Add content 2) Set duration to 60s  
**Expected:** Duration saved per item  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-005.png`

## TC-011-006: Save Playlist
**Steps:** 1) Complete playlist 2) Click "Save"  
**Expected:** Success toast, playlist appears in list  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-006.png`

## TC-011-007: Name Validation
**Steps:** 1) Leave name empty 2) Try to save  
**Expected:** Error: "Playlist name is required"  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-007.png`

## TC-011-008: Minimum Content Validation
**Steps:** 1) Create playlist with 0 items 2) Save  
**Expected:** Error: "Add at least one content item"  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-008.png`

## TC-011-009: Edit Existing Playlist
**Steps:** 1) Click "Edit" on playlist 2) Modify 3) Save  
**Expected:** Changes persisted  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-009.png`

## TC-011-010: Remove Item from Playlist
**Steps:** 1) Edit playlist 2) Click "X" on item 3) Save  
**Expected:** Item removed  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-010.png`

## TC-011-011: Total Duration Display
**Steps:** 1) Add 3 items (30s each) 2) Check total  
**Expected:** Shows "Total: 90s" or "1m 30s"  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-011.png`

## TC-011-012: Cancel Create/Edit
**Steps:** 1) Make changes 2) Click Cancel  
**Expected:** Modal closes, changes discarded  
**Evidence:** `.bmad/testing/evidence/story-011/TC-011-012.png`

---

**Summary:** 12 cases | 0 passed | 12 not run | Est: 35 min
