# Story 007: Content Upload (Image/Video/PDF/URL)

**ID:** STORY-007  
**Module:** Content Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28  
**Updated:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** upload various types of content  
**So that** I can display them on my screens

---

## Acceptance Criteria

### AC-001: Upload Image
**Given** I am on the content page  
**When** I click "Upload Content" and select "Image"  
**Then** I should be able to:
- Browse and select image file (JPEG, PNG, GIF, WebP)
- Provide a title
- Upload the file

**Validation:**
- File type: image/* only
- File size: <50MB (security limit)
- Title: required, 2-100 characters

### AC-002: Upload Video
**Given** I click "Upload Content" and select "Video"  
**When** I choose a video file  
**Then** I should be able to:
- Upload MP4, WebM, MOV formats
- Provide title and duration

**Validation:**
- File type: video/* only
- File size: <50MB
- Duration: optional, auto-detected if possible

### AC-003: Upload PDF
**Given** I select "PDF" content type  
**When** I upload a PDF file  
**Then** the file should be stored
**And** be previewable in sandboxed viewer

**Validation:**
- File type: application/pdf only
- File size: <50MB

### AC-004: Add URL Content
**Given** I select "URL" content type  
**When** I provide a URL  
**Then** the URL should be saved
**And** be displayable on screens

**Validation:**
- URL format: valid http/https
- URL reachable (optional check)

### AC-005: Bulk Upload
**Given** I have multiple images  
**When** I select multiple files  
**Then** all files should upload sequentially
**And** progress should be shown

---

## Implementation Details

**Frontend Files:**
- `web/src/app/dashboard/content/page.tsx` (upload UI)
- Upload modal with file picker
- Drag-and-drop zone

**Backend Files:**
- `middleware/src/modules/content/content.controller.ts`
- POST `/content/upload` (multipart/form-data)
- File storage: `static/uploads/` directory

**File Handling:**
- Multer middleware for file uploads
- File naming: `{timestamp}-{uuid}.{ext}`
- Thumbnail generation: Story-010

---

## Test Cases

See: `.bmad/testing/test-cases/story-007-tests.md`

**Total Test Cases:** 15  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0

---

## Known Issues

- ✅ Fixed: Content upload 400 error (title→name mapping) - 2026-01-27
- ✅ Fixed: File upload validation - 2026-01-28

---

## Dependencies

- Organization context
- File storage configured
- sharp.js for image processing

---

## Bugs Found

None yet - testing pending

---

**Status:** ⏳ READY FOR TEST
