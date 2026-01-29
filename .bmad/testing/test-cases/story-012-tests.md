# Test Cases: Story 012 - Playlist Drag-Drop Ordering

**Story ID:** STORY-012 | **Priority:** P0 | **Time:** 20 min | **Cases:** 6

**Note:** Partially covered in Story-021 (TC-021-019)

---

## TC-012-001: Drag Handle Visibility
**Steps:** 1) Edit playlist with 3+ items 2) Check for drag handle  
**Expected:** ⋮⋮ icon or handle visible on each item  
**Evidence:** `.bmad/testing/evidence/story-012/TC-012-001.png`

## TC-012-002: Cursor Change on Hover
**Steps:** 1) Hover over drag handle  
**Expected:** Cursor changes to grab/move cursor  
**Evidence:** `.bmad/testing/evidence/story-012/TC-012-002.png`

## TC-012-003: Drag Item Up
**Steps:** 1) Drag item #3 to position #1 2) Drop  
**Expected:** Order changes immediately, visual feedback  
**Evidence:** `.bmad/testing/evidence/story-012/TC-012-003.png`

## TC-012-004: Drag Item Down
**Steps:** 1) Drag item #1 to position #3 2) Drop  
**Expected:** Order updates  
**Evidence:** `.bmad/testing/evidence/story-012/TC-012-004.png`

## TC-012-005: Order Persistence
**Steps:** 1) Reorder items 2) Save 3) Reload page 4) Edit again  
**Expected:** Order persists after save and reload  
**Evidence:** `.bmad/testing/evidence/story-012/TC-012-005.png`

## TC-012-006: Touch Support (Mobile)
**Steps:** 1) Open on tablet/mobile 2) Long-press and drag  
**Expected:** Drag works on touch devices  
**Evidence:** `.bmad/testing/evidence/story-012/TC-012-006.png`

---

**Summary:** 6 cases | 0 passed | 6 not run | Est: 20 min
