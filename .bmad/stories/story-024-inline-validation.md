# Story 024: Inline Validation Errors

**ID:** STORY-024  
**Module:** UI/UX Enhancements  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want** inline validation errors  
**So that** I know exactly what's wrong with my input

---

## Acceptance Criteria

### AC-001: Field-Level Errors
- Show errors below each field
- Red text with error icon
- Specific error messages

### AC-002: Validation Timing
- Show on submit (not while typing)
- Clear on blur when fixed
- Prevent form submission if errors

### AC-003: Error Messages
- Required fields: "[Field] is required"
- Format errors: "Please enter a valid [type]"
- Length errors: "[Field] must be X-Y characters"

### AC-004: Multiple Errors
- Show all field errors simultaneously
- Don't hide errors on other fields
- Toast notification for general errors only

---

## Implementation

**Files:**
- `web/src/components/FieldError.tsx`
- `web/src/lib/validation.ts` (extractFieldErrors helper)

**Applied To:**
- Login form
- Registration form
- Content upload
- Device edit

---

## Test Cases

See: `.bmad/testing/test-cases/story-024-tests.md`  
**Total:** 12 test cases

---

**Status:** ⏳ READY FOR TEST
