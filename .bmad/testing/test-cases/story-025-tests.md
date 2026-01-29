# Test Cases: Story 025 - Display App Pairing

**Story ID:** STORY-025 | **Priority:** P0 | **Time:** 30 min | **Cases:** 10

---

## TC-025-001: Launch Display App
**Steps:** 1) Run `npm run dev` in display folder  
**Expected:** Electron window opens  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-001.png`

## TC-025-002: Pairing Code Displayed
**Steps:** 1) Check display screen  
**Expected:** 6-character code shown in large font  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-002.png`

## TC-025-003: Code Readable from Distance
**Steps:** 1) View code from 10 feet away  
**Expected:** Code clearly readable  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-003.png`

## TC-025-004: Instructions Shown
**Steps:** 1) Check pairing screen  
**Expected:** Instructions: "Enter this code at [URL]"  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-004.png`

## TC-025-005: Code Auto-Refresh
**Steps:** 1) Note code 2) Wait 5+ minutes  
**Expected:** Code refreshes automatically (optional)  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-005.png`

## TC-025-006: Polling for Pairing Status
**Steps:** 1) Check DevTools console 2) Watch requests  
**Expected:** Polls for pairing status every 5 seconds  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-006.png`

## TC-025-007: Pairing Success Message
**Steps:** 1) Complete pairing from web 2) Check display  
**Expected:** "Pairing successful!" message shown  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-007.png`

## TC-025-008: Transition to Content View
**Steps:** 1) After pairing success 2) Wait 2 seconds  
**Expected:** Transitions to content display view  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-008.png`

## TC-025-009: Connection Status Indicator
**Steps:** 1) Check display header/footer  
**Expected:** Shows "Connected" status  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-009.png`

## TC-025-010: Error Handling - Pairing Timeout
**Steps:** 1) Enter invalid code 3 times  
**Expected:** Error shown, stops polling (threshold reached)  
**Evidence:** `.bmad/testing/evidence/story-025/TC-025-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 30 min
