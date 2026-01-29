# Test Cases: Story 004 - Device Pairing Flow

**Story ID:** STORY-004  
**Module:** Device Management  
**Created:** 2026-01-28  
**Priority:** P0 - Critical

---

## Test Case Summary

**Total Cases:** 10  
**P0 Critical:** 8  
**P1 High:** 2  
**Estimated Time:** 35 minutes

---

## TC-004-001: Add Device Button

**Priority:** P0  
**Pre-conditions:**
- Logged in
- On devices page

**Test Steps:**
1. Navigate to `/dashboard/devices`
2. Locate "Add Device" button
3. Click button
4. Observe result

**Expected Result:**
- Pairing modal opens
- Modal shows title "Pair New Device"
- Form displayed with code entry field
- Instructions visible

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-001.png`

---

## TC-004-002: Pairing Code Entry - Valid Code

**Priority:** P0  
**Pre-conditions:**
- Display app showing pairing code (e.g., "ABC123")
- Pairing modal open

**Test Steps:**
1. Enter code from display: `ABC123`
2. Enter device name: `Lobby Display`
3. Enter location (optional): `Main Lobby`
4. Click "Pair Device"
5. Observe result

**Expected Result:**
- Pairing succeeds
- Success message: "Device paired successfully"
- Modal closes
- Device appears in list immediately
- Display shows "Pairing successful"

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-002.png`

---

## TC-004-003: Pairing Code Validation - Invalid Format

**Priority:** P0  
**Pre-conditions:**
- Pairing modal open

**Test Steps:**
1. Enter invalid code: `12`
2. Click "Pair Device"

**Expected Result:**
- Error message: "Please enter a 6-digit code"
- Form does not submit
- Error shown below code field

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-003.png`

---

## TC-004-004: Pairing Code Validation - Non-Existent Code

**Priority:** P0  
**Pre-conditions:**
- Pairing modal open

**Test Steps:**
1. Enter code that doesn't exist: `ZZZ999`
2. Enter device name
3. Click "Pair Device"

**Expected Result:**
- Error message: "Invalid pairing code" or "Code not found"
- Pairing fails
- Stay on pairing modal

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-004.png`

---

## TC-004-005: Device Name Validation

**Priority:** P0  
**Pre-conditions:**
- Pairing modal open
- Valid code entered

**Test Steps:**
1. Enter valid code
2. Leave device name empty
3. Click "Pair Device"

**Expected Result:**
- Error: "Device name is required"
- Form does not submit
- Error shown below name field

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-005.png`

---

## TC-004-006: Device Appears in List

**Priority:** P0  
**Pre-conditions:**
- Device just paired

**Test Steps:**
1. Complete pairing (TC-004-002)
2. Check devices list
3. Locate newly paired device
4. Verify details

**Expected Result:**
- Device visible in list
- Name: "Lobby Display"
- Location: "Main Lobby"
- Status: Online (green badge)
- Last seen: "Just now"

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-006.png`

---

## TC-004-007: Cancel Pairing

**Priority:** P1  
**Pre-conditions:**
- Pairing modal open

**Test Steps:**
1. Click "Add Device" button
2. Enter partial information
3. Click "Cancel" or "X" button
4. Observe result

**Expected Result:**
- Modal closes
- No device created
- Return to devices list
- Partial data discarded

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-007.png`

---

## TC-004-008: Location Optional Field

**Priority:** P1  
**Pre-conditions:**
- Pairing modal open

**Test Steps:**
1. Enter valid code
2. Enter device name: `Test Display`
3. Leave location empty
4. Click "Pair Device"

**Expected Result:**
- Pairing succeeds
- Location shown as "-" or "Not specified"
- Device created without location

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-008.png`

---

## TC-004-009: Pairing Error Handling

**Priority:** P0  
**Pre-conditions:**
- Middleware stopped OR network offline

**Test Steps:**
1. Stop middleware (or go offline)
2. Try to pair device
3. Observe error handling

**Expected Result:**
- Error message displayed
- Clear error: "Unable to connect" or "Pairing failed"
- Modal stays open
- Can retry

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-009.png`

---

## TC-004-010: Display App Pairing Screen

**Priority:** P0  
**Pre-conditions:**
- Display app running
- Not paired

**Test Steps:**
1. Launch display app (Electron)
2. Observe pairing screen
3. Note code displayed
4. Check instructions

**Expected Result:**
- Pairing code visible (large font)
- Code: 6 characters
- Instructions: "Enter this code at [URL]"
- Code readable from 10 feet away

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-004/TC-004-010.png`

---

## Test Execution Log

| TC ID | Date | Time | Status | Tester | Notes |
|-------|------|------|--------|--------|-------|
| TC-004-001 | - | - | ⏳ | - | - |
| TC-004-002 | - | - | ⏳ | - | - |
| TC-004-003 | - | - | ⏳ | - | - |
| TC-004-004 | - | - | ⏳ | - | - |
| TC-004-005 | - | - | ⏳ | - | - |
| TC-004-006 | - | - | ⏳ | - | - |
| TC-004-007 | - | - | ⏳ | - | - |
| TC-004-008 | - | - | ⏳ | - | - |
| TC-004-009 | - | - | ⏳ | - | - |
| TC-004-010 | - | - | ⏳ | - | Requires display app |

---

## Summary

**Total:** 10 test cases  
**Passed:** 0  
**Failed:** 0  
**Not Run:** 10

**Estimated Time:** 35 minutes
