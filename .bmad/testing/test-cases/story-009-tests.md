# Test Cases: Story 009 - Content Preview

**Story ID:** STORY-009 | **Priority:** P0 | **Time:** 30 min | **Cases:** 10

**Note:** Most cases already covered in Story-021 (TC-021-011 to TC-021-014)

---

## TC-009-001: Preview Button Visibility
**Steps:** 1) View content grid 2) Check for preview button  
**Expected:** "Preview" button on each content item  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-001.png`

## TC-009-002: Preview Modal Opens
**Steps:** 1) Click "Preview" button  
**Expected:** Modal opens immediately  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-002.png`

## TC-009-003: Preview Image (Detailed)
**Steps:** 1) Preview image 2) Test zoom toggle 3) Check quality  
**Expected:** Full-size, sharp, zoom works  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-003.png`

## TC-009-004: Preview Video Controls
**Steps:** 1) Preview video 2) Test play/pause/volume/seek  
**Expected:** All controls functional  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-004.png`

## TC-009-005: Preview PDF Sandbox Security
**Steps:** 1) Preview PDF 2) Open DevTools console 3) Check for warnings  
**Expected:** Sandbox attribute present, no XSS warnings  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-005.png`

## TC-009-006: Preview URL External Link
**Steps:** 1) Preview URL content 2) Click link  
**Expected:** Opens in new tab with noopener  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-006.png`

## TC-009-007: Close Modal - ESC Key
**Steps:** 1) Open preview 2) Press ESC  
**Expected:** Modal closes  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-007.png`

## TC-009-008: Close Modal - Click Outside
**Steps:** 1) Open preview 2) Click backdrop  
**Expected:** Modal closes  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-008.png`

## TC-009-009: Close Modal - X Button
**Steps:** 1) Open preview 2) Click X button  
**Expected:** Modal closes  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-009.png`

## TC-009-010: Preview Error Handling
**Steps:** 1) Preview content with broken file  
**Expected:** Error message shown, graceful degradation  
**Evidence:** `.bmad/testing/evidence/story-009/TC-009-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 30 min
