# Test Cases: Story 013 - Duration Management

**Story ID:** STORY-013 | **Priority:** P0 | **Time:** 20 min | **Cases:** 6

**Note:** Partially covered in Story-021 (TC-021-018)

---

## TC-013-001: Default Duration
**Steps:** 1) Add new content to playlist 2) Check duration  
**Expected:** Default 30 seconds  
**Evidence:** `.bmad/testing/evidence/story-013/TC-013-001.png`

## TC-013-002: Edit Duration Inline
**Steps:** 1) Click duration input 2) Change to 60 3) Tab away  
**Expected:** Duration updates immediately  
**Evidence:** `.bmad/testing/evidence/story-013/TC-013-002.png`

## TC-013-003: Minimum Duration Validation
**Steps:** 1) Enter duration: 0  
**Expected:** Error or revert to 1  
**Evidence:** `.bmad/testing/evidence/story-013/TC-013-003.png`

## TC-013-004: Maximum Duration Validation
**Steps:** 1) Enter duration: 500  
**Expected:** Error: "Max 300 seconds (5 minutes)"  
**Evidence:** `.bmad/testing/evidence/story-013/TC-013-004.png`

## TC-013-005: Duration Format Display
**Steps:** 1) View playlist items  
**Expected:** Duration shown as "30s", "120s", etc.  
**Evidence:** `.bmad/testing/evidence/story-013/TC-013-005.png`

## TC-013-006: Total Playlist Duration
**Steps:** 1) Add items with different durations 2) Check total  
**Expected:** Total duration calculated and displayed  
**Evidence:** `.bmad/testing/evidence/story-013/TC-013-006.png`

---

**Summary:** 6 cases | 0 passed | 6 not run | Est: 20 min
