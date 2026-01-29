# Test Cases: Story 015 - Schedule Creation

**Story ID:** STORY-015 | **Priority:** P1 | **Time:** 35 min | **Cases:** 10

---

## TC-015-001: Create Schedule Button
**Steps:** 1) Navigate to schedules page 2) Click "Create Schedule"  
**Expected:** Schedule form modal opens  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-001.png`

## TC-015-002: Schedule Name Input
**Steps:** 1) Enter name: "Morning Schedule"  
**Expected:** Name accepted  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-002.png`

## TC-015-003: Date Range Picker
**Steps:** 1) Click start date 2) Select date 3) Click end date 4) Select  
**Expected:** Date range set  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-003.png`

## TC-015-004: Time Range Picker
**Steps:** 1) Set start time: 06:00 2) Set end time: 12:00  
**Expected:** Time range accepted  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-004.png`

## TC-015-005: Days of Week Selection
**Steps:** 1) Check "Monday" through "Friday"  
**Expected:** Weekdays selected, weekends unchecked  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-005.png`

## TC-015-006: Assign Playlist
**Steps:** 1) Select playlist from dropdown  
**Expected:** Playlist assigned to schedule  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-006.png`

## TC-015-007: Save Schedule
**Steps:** 1) Complete form 2) Click "Save"  
**Expected:** Success, schedule appears in list  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-007.png`

## TC-015-008: Validation - End Before Start
**Steps:** 1) Set end date before start date 2) Try save  
**Expected:** Error: "End date must be after start date"  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-008.png`

## TC-015-009: Validation - No Days Selected
**Steps:** 1) Leave all days unchecked 2) Save  
**Expected:** Error: "Select at least one day"  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-009.png`

## TC-015-010: Active Schedule Indicator
**Steps:** 1) View schedules list during active time  
**Expected:** Active schedule shows "Active Now" badge  
**Evidence:** `.bmad/testing/evidence/story-015/TC-015-010.png`

---

**Summary:** 10 cases | 0 passed | 10 not run | Est: 35 min
