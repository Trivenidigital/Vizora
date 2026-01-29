# Test Cases: Story 027 - Display App Playlist Playback

**Story ID:** STORY-027 | **Priority:** P0 | **Time:** 35 min | **Cases:** 10

---

## TC-027-001: Load Playlist
**Steps:** 1) Assign playlist to device 2) Check display  
**Expected:** Playlist loads, first item displays  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-001.png`

## TC-027-002: Play First Item
**Steps:** 1) Start playlist  
**Expected:** First item plays for specified duration  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-002.png`

## TC-027-003: Transition to Next Item
**Steps:** 1) Wait for duration to complete  
**Expected:** Smooth transition to item 2  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-003.png`

## TC-027-004: Respect Item Duration
**Steps:** 1) Item set to 45s 2) Time it  
**Expected:** Displays for exactly 45 seconds  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-004.png`

## TC-027-005: Loop Playlist
**Steps:** 1) Play through all items 2) Watch after last  
**Expected:** Returns to first item, loops continuously  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-005.png`

## TC-027-006: Transition Animation
**Steps:** 1) Watch transition between items  
**Expected:** Fade or smooth transition (not abrupt cut)  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-006.png`

## TC-027-007: Receive Playlist Update
**Steps:** 1) Playing playlist 2) Push new playlist  
**Expected:** Switches to new playlist immediately  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-007.png`

## TC-027-008: Skip Failed Content
**Steps:** 1) Playlist with broken item in middle 2) Play  
**Expected:** Skips broken item, continues to next  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-008.png`

## TC-027-009: Continue Playback on Error
**Steps:** 1) Simulate item load error  
**Expected:** Error logged, playback continues  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-009.png`

## TC-027-010: Current Item Indicator (Optional)
**Steps:** 1) Check display UI  
**Expected:** Shows current item (X of Y) - optional feature  
**Evidence:** `.bmad/testing/evidence/story-027/TC-027-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 35 min
