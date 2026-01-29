# Test Cases: Story 007 - Content Upload

**Story ID:** STORY-007 | **Priority:** P0 | **Time:** 40 min | **Cases:** 15

---

## TC-007-001: Upload Button
**Steps:** 1) Navigate to content page 2) Click "Upload Content"  
**Expected:** Upload modal opens  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-001.png`

## TC-007-002: Upload Image - JPEG
**Steps:** 1) Select "Image" 2) Choose JPEG file 3) Enter title 4) Upload  
**Expected:** Success, image appears in grid  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-002.png`

## TC-007-003: Upload Image - PNG
**Steps:** 1) Upload PNG file with title  
**Expected:** Success, PNG displays  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-003.png`

## TC-007-004: Upload Video - MP4
**Steps:** 1) Select "Video" 2) Choose MP4 3) Title 4) Upload  
**Expected:** Success, video in grid with thumbnail  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-004.png`

## TC-007-005: Upload PDF
**Steps:** 1) Select "PDF" 2) Choose PDF file 3) Title 4) Upload  
**Expected:** Success, PDF icon/thumbnail shown  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-005.png`

## TC-007-006: Add URL Content
**Steps:** 1) Select "URL" 2) Enter URL 3) Title 4) Save  
**Expected:** URL content created  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-006.png`

## TC-007-007: Upload Progress Indicator
**Steps:** 1) Upload 5MB file 2) Watch progress  
**Expected:** Progress bar/spinner, percentage shown  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-007.png`

## TC-007-008: Title Validation
**Steps:** 1) Select file 2) Leave title empty 3) Upload  
**Expected:** Error: "Title is required"  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-008.png`

## TC-007-009: File Size Limit (>50MB)
**Steps:** 1) Try to upload 51MB file  
**Expected:** Error or rejection, "File too large (max 50MB)"  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-009.png`

## TC-007-010: Invalid File Type
**Steps:** 1) Try to upload .exe or unsupported file  
**Expected:** Error: "Unsupported file type"  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-010.png`

## TC-007-011: Bulk Upload (Multiple Files)
**Steps:** 1) Select 3 images 2) Upload all  
**Expected:** All 3 upload sequentially, all appear  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-011.png`

## TC-007-012: Upload Success Notification
**Steps:** 1) Complete upload  
**Expected:** Toast: "Content uploaded successfully"  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-012.png`

## TC-007-013: Upload Error Handling
**Steps:** 1) Stop middleware 2) Try upload  
**Expected:** Error message, retry option  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-013.png`

## TC-007-014: Drag-and-Drop Upload
**Steps:** 1) Drag image file onto upload zone  
**Expected:** File selected, ready to upload  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-014.png`

## TC-007-015: URL Validation
**Steps:** 1) Enter invalid URL: "not-a-url" 2) Save  
**Expected:** Error: "Please enter a valid URL"  
**Evidence:** `.bmad/testing/evidence/story-007/TC-007-015.png`

---

**Summary:** 15 cases | 0 passed | 15 not run | Est: 40 min
