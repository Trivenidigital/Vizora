# Test Cases: Story 018 - Instant Content Push

**Story ID:** STORY-018 | **Priority:** P0 | **Time:** 35 min | **Cases:** 10

---

## TC-018-001: Push Button Visibility
**Steps:** 1) View playlists page 2) Check for "Push" button  
**Expected:** "Push Now" or "Push to Devices" button visible  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-001.png`

## TC-018-002: Device Selection Modal
**Steps:** 1) Click "Push" 2) Observe modal  
**Expected:** Modal with device selection checkboxes  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-002.png`

## TC-018-003: Select Single Device
**Steps:** 1) Check 1 device 2) Continue  
**Expected:** Device selected, count shown  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-003.png`

## TC-018-004: Select Multiple Devices
**Steps:** 1) Check 3 devices 2) Continue  
**Expected:** All 3 selected, "Push to 3 devices" shown  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-004.png`

## TC-018-005: Push Confirmation Dialog
**Steps:** 1) Select devices 2) Click "Push"  
**Expected:** Confirmation: "Push playlist to X devices?"  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-005.png`

## TC-018-006: Confirm Push - Single Device
**Steps:** 1) Confirm push 2) Watch display  
**Expected:** Content updates in <1 second  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-006.png`

## TC-018-007: Confirm Push - Multiple Devices
**Steps:** 1) Push to 3 devices 2) Verify all  
**Expected:** All 3 devices update simultaneously  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-007.png`

## TC-018-008: Push Success Notification
**Steps:** 1) Complete push  
**Expected:** Toast: "Playlist pushed to X devices"  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-008.png`

## TC-018-009: Push Error Handling
**Steps:** 1) Offline device in selection 2) Push  
**Expected:** Partial success message or skip offline devices  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-009.png`

## TC-018-010: Cancel Push
**Steps:** 1) Select devices 2) Cancel  
**Expected:** Modal closes, no push executed  
**Evidence:** `.bmad/testing/evidence/story-018/TC-018-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 35 min
