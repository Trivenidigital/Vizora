# Test Cases: Story 017 - Schedule Conflicts & Priority

**Story ID:** STORY-017 | **Priority:** P1 | **Time:** 30 min | **Cases:** 8

---

## TC-017-001: Create Overlapping Schedule
**Steps:** 1) Create schedule 9am-5pm 2) Create another 12pm-6pm  
**Expected:** Warning shown: "Conflicts with existing schedule"  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-001.png`

## TC-017-002: Set Priority
**Steps:** 1) Create schedule 2) Set priority to 5  
**Expected:** Priority saved  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-002.png`

## TC-017-003: Priority Range Validation
**Steps:** 1) Try priority: 11 (invalid)  
**Expected:** Error: "Priority must be 1-10"  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-003.png`

## TC-017-004: Higher Priority Wins
**Steps:** 1) Schedule A (priority 3, 9am-5pm) 2) Schedule B (priority 7, 12pm-3pm) 3) Check 1pm  
**Expected:** Schedule B active (higher priority)  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-004.png`

## TC-017-005: Default Priority
**Steps:** 1) Create schedule without setting priority  
**Expected:** Default priority: 1 (lowest)  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-005.png`

## TC-017-006: Priority Badge Display
**Steps:** 1) View schedules list  
**Expected:** Priority shown as badge/number  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-006.png`

## TC-017-007: Override Confirmation
**Steps:** 1) Create conflicting schedule 2) Try to save  
**Expected:** Confirmation: "Override existing schedule?"  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-007.png`

## TC-017-008: Fallback to Default Playlist
**Steps:** 1) No active schedule 2) Check device  
**Expected:** Default playlist plays (if assigned)  
**Evidence:** `.bmad/testing/evidence/story-017/TC-017-008.png`

---

**Summary:** 8 cases | 0 passed | 8 not run | Est: 30 min
