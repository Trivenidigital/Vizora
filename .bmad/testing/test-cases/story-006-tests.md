# Test Cases: Story 006 - Device Management (Edit/Delete)

**Story ID:** STORY-006 | **Priority:** P0 | **Time:** 30 min | **Cases:** 10

---

## TC-006-001: Edit Button Click
**Steps:** 1) Click "Edit" button on device row  
**Expected:** Edit modal opens with current device data  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-001.png`

## TC-006-002: Edit Device Name
**Steps:** 1) Open edit modal 2) Change name to "Updated Display" 3) Save  
**Expected:** Success toast, name updated in list  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-002.png`

## TC-006-003: Edit Location
**Steps:** 1) Change location to "New Location" 2) Save  
**Expected:** Location updated, persists after reload  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-003.png`

## TC-006-004: Edit Name Validation
**Steps:** 1) Clear device name 2) Try to save  
**Expected:** Error: "Device name is required"  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-004.png`

## TC-006-005: Cancel Edit
**Steps:** 1) Make changes 2) Click Cancel  
**Expected:** Modal closes, changes discarded  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-005.png`

## TC-006-006: Delete Button Click
**Steps:** 1) Click "Delete" button  
**Expected:** Confirmation dialog appears  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-006.png`

## TC-006-007: Delete Confirmation Dialog
**Steps:** 1) Check confirmation text  
**Expected:** Shows device name, warns about data loss  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-007.png`

## TC-006-008: Confirm Delete
**Steps:** 1) Click "Delete" in confirmation 2) Observe  
**Expected:** Device removed from list, success toast  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-008.png`

## TC-006-009: Cancel Delete
**Steps:** 1) Click "Cancel" in confirmation  
**Expected:** Dialog closes, device remains  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-009.png`

## TC-006-010: Unpair Detection (Display App)
**Steps:** 1) Delete device while display app running 2) Check display  
**Expected:** Display returns to pairing screen  
**Evidence:** `.bmad/testing/evidence/story-006/TC-006-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 30 min
