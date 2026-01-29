# Test Cases: Story 026 - Display App Content Rendering

**Story ID:** STORY-026 | **Priority:** P0 | **Time:** 40 min | **Cases:** 12

---

## TC-026-001: Image Display Full-Screen
**Steps:** 1) Push image content 2) Check display  
**Expected:** Image fills screen, no letterboxing  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-001.png`

## TC-026-002: Image Aspect Ratio Maintained
**Steps:** 1) Display image with 16:9 aspect 2) Check  
**Expected:** Aspect ratio preserved, centered  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-002.png`

## TC-026-003: Image Quality
**Steps:** 1) Display high-res image 2) Check quality  
**Expected:** Sharp, no pixelation  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-003.png`

## TC-026-004: Video Auto-Play
**Steps:** 1) Push video content 2) Watch display  
**Expected:** Video starts playing automatically  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-004.png`

## TC-026-005: Video Full-Screen
**Steps:** 1) Play video  
**Expected:** Video fills screen, no controls shown  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-005.png`

## TC-026-006: Video Audio (Optional)
**Steps:** 1) Play video with audio  
**Expected:** Audio plays if enabled  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-006.png`

## TC-026-007: PDF Display
**Steps:** 1) Push PDF content  
**Expected:** PDF displays in viewer  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-007.png`

## TC-026-008: PDF Page Navigation (If Auto-Advance)
**Steps:** 1) Display multi-page PDF 2) Wait  
**Expected:** Pages advance automatically (optional)  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-008.png`

## TC-026-009: URL/Iframe Display
**Steps:** 1) Push URL content  
**Expected:** Website loads in iframe, full-screen  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-009.png`

## TC-026-010: Error Handling - Missing File
**Steps:** 1) Push content with deleted file  
**Expected:** Error message or skip to next  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-010.png`

## TC-026-011: Error Handling - Corrupt File
**Steps:** 1) Push corrupt image/video  
**Expected:** Graceful error, continues playback  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-011.png`

## TC-026-012: Loading State
**Steps:** 1) Push large video 2) Watch transition  
**Expected:** Loading indicator while buffering  
**Evidence:** `.bmad/testing/evidence/story-026/TC-026-012.png`

---

**Summary:** 12 cases | 0 passed | 12 not run | Est: 40 min
