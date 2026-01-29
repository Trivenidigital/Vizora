# Test Cases: Story 024 - Inline Validation

**Story ID:** STORY-024 | **Priority:** P0 | **Time:** 35 min | **Cases:** 12

**Note:** Partially covered in Story-021 (TC-021-005, TC-021-006)

---

## TC-024-001: Login Email Validation
**Steps:** 1) Leave email empty 2) Submit  
**Expected:** Error below email: "Email is required"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-001.png`

## TC-024-002: Login Password Validation
**Steps:** 1) Leave password empty 2) Submit  
**Expected:** Error below password: "Password is required"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-002.png`

## TC-024-003: Registration Email Format
**Steps:** 1) Enter "notanemail" 2) Submit  
**Expected:** Error: "Please enter a valid email"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-003.png`

## TC-024-004: Password Strength Validation
**Steps:** 1) Enter weak password: "pass" 2) Submit  
**Expected:** Error: "Password must be at least 8 characters"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-004.png`

## TC-024-005: Content Upload Title Required
**Steps:** 1) Select file 2) Leave title empty 3) Upload  
**Expected:** Error: "Title is required"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-005.png`

## TC-024-006: Device Name Required
**Steps:** 1) Edit device 2) Clear name 3) Save  
**Expected:** Error: "Device name is required"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-006.png`

## TC-024-007: Multiple Field Errors
**Steps:** 1) Submit form with 3 empty required fields  
**Expected:** All 3 errors shown simultaneously  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-007.png`

## TC-024-008: Error Clears on Fix (Blur)
**Steps:** 1) Show error 2) Fix field 3) Tab away  
**Expected:** Error disappears on blur  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-008.png`

## TC-024-009: Error Red Styling
**Steps:** 1) Trigger validation error  
**Expected:** Red text, red border on input (optional)  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-009.png`

## TC-024-010: No Toast Duplication
**Steps:** 1) Trigger inline error  
**Expected:** NO toast notification (inline only)  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-010.png`

## TC-024-011: FieldError Component Render
**Steps:** 1) Inspect error element  
**Expected:** Uses FieldError component (check class/structure)  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-011.png`

## TC-024-012: Accessibility (ARIA)
**Steps:** 1) Trigger error 2) Check aria-invalid attribute  
**Expected:** Input has aria-invalid="true"  
**Evidence:** `.bmad/testing/evidence/story-024/TC-024-012.png`

---

**Summary:** 12 cases | 0 passed | 12 not run | Est: 35 min
