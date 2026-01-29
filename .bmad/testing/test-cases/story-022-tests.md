# Test Cases: Story 022 - Sortable Columns

**Story ID:** STORY-022 | **Priority:** P0 | **Time:** 25 min | **Cases:** 8

**Note:** Partially covered in Story-021 (TC-021-001, TC-021-002)

---

## TC-022-001: Sort Device Name Ascending
**Steps:** 1) Click "Device" column header  
**Expected:** Devices sorted A-Z, ↑ indicator shown  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-001.png`

## TC-022-002: Sort Device Name Descending
**Steps:** 1) Click "Device" again  
**Expected:** Devices sorted Z-A, ↓ indicator shown  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-002.png`

## TC-022-003: Clear Sort (Third Click)
**Steps:** 1) Click "Device" third time  
**Expected:** Sort cleared, original order, no indicator  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-003.png`

## TC-022-004: Sort Status Column
**Steps:** 1) Click "Status" column  
**Expected:** Online first, then offline  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-004.png`

## TC-022-005: Sort Location Column
**Steps:** 1) Click "Location"  
**Expected:** Alphabetical by location  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-005.png`

## TC-022-006: Sort Last Seen Column
**Steps:** 1) Click "Last Seen"  
**Expected:** Most recent first (descending)  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-006.png`

## TC-022-007: Sort Content by Upload Date
**Steps:** 1) Navigate to content 2) Click "Upload Date"  
**Expected:** Newest first  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-007.png`

## TC-022-008: Sort Persistence (Session)
**Steps:** 1) Sort by name 2) Navigate away 3) Return  
**Expected:** Sort persists during session (optional)  
**Evidence:** `.bmad/testing/evidence/story-022/TC-022-008.png`

---

**Summary:** 8 cases | 0 passed | 8 not run | Est: 25 min
