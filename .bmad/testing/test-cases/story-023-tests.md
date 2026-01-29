# Test Cases: Story 023 - Pagination

**Story ID:** STORY-023 | **Priority:** P0 | **Time:** 30 min | **Cases:** 10

**Note:** Partially covered in Story-021 (TC-021-003, TC-021-004)

---

## TC-023-001: Default Items Per Page
**Steps:** 1) Navigate to devices page  
**Expected:** Shows 10 items by default  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-001.png`

## TC-023-002: Change to 25 Per Page
**Steps:** 1) Click dropdown 2) Select "25"  
**Expected:** Shows 25 items, page updates  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-002.png`

## TC-023-003: Change to 50 Per Page
**Steps:** 1) Select "50"  
**Expected:** Shows up to 50 items  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-003.png`

## TC-023-004: Change to 100 Per Page
**Steps:** 1) Select "100"  
**Expected:** Shows up to 100 items  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-004.png`

## TC-023-005: Next Page Button
**Steps:** 1) Click "Next" on page 1  
**Expected:** Navigates to page 2, shows items 11-20  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-005.png`

## TC-023-006: Previous Page Button
**Steps:** 1) On page 2, click "Previous"  
**Expected:** Returns to page 1  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-006.png`

## TC-023-007: Direct Page Number Click
**Steps:** 1) Click page number "3"  
**Expected:** Jumps to page 3  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-007.png`

## TC-023-008: Disabled Previous (Page 1)
**Steps:** 1) Check Previous button on page 1  
**Expected:** Button disabled/grayed out  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-008.png`

## TC-023-009: Disabled Next (Last Page)
**Steps:** 1) Navigate to last page 2) Check Next button  
**Expected:** Button disabled  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-009.png`

## TC-023-010: Status Text
**Steps:** 1) Check pagination status text  
**Expected:** "Showing X to Y of Z items"  
**Evidence:** `.bmad/testing/evidence/story-023/TC-023-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 30 min
