# Test Cases: Story 010 - Thumbnail Generation

**Story ID:** STORY-010 | **Priority:** P0 | **Time:** 25 min | **Cases:** 8

**Note:** Partially covered in Story-021 (TC-021-009, TC-021-010)

---

## TC-010-001: Auto-Generate on Upload
**Steps:** 1) Upload image 2) Wait for completion 3) Check grid  
**Expected:** Thumbnail generated automatically, displays in grid  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-001.png`

## TC-010-002: Thumbnail Size
**Steps:** 1) Upload image 2) Inspect thumbnail element  
**Expected:** 300x300px max, maintains aspect ratio  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-002.png`

## TC-010-003: Thumbnail Quality
**Steps:** 1) Upload high-res image 2) View thumbnail  
**Expected:** Sharp, clear, not pixelated  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-003.png`

## TC-010-004: File Size Limit Security
**Steps:** 1) Upload >50MB image  
**Expected:** Thumbnail generation skipped OR error  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-004.png`

## TC-010-005: Fallback for No Thumbnail
**Steps:** 1) View content without thumbnail  
**Expected:** Emoji fallback (🖼️ for image, 🎥 for video)  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-005.png`

## TC-010-006: Thumbnail Storage Location
**Steps:** 1) Upload image 2) Check filesystem  
**Expected:** Thumbnail saved in `/static/thumbnails/`  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-006.png`

## TC-010-007: Bulk Upload Thumbnails
**Steps:** 1) Upload 5 images at once 2) Check all thumbnails  
**Expected:** All 5 thumbnails generated  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-007.png`

## TC-010-008: Video Thumbnail (Optional)
**Steps:** 1) Upload video 2) Check for thumbnail  
**Expected:** First frame extracted (if implemented) OR video icon  
**Evidence:** `.bmad/testing/evidence/story-010/TC-010-008.png`

---

**Summary:** 8 cases | 0 passed | 8 not run | Est: 25 min
