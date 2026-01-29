# Test Cases: Story 008 - Content Library Management

**Story ID:** STORY-008 | **Priority:** P0 | **Time:** 35 min | **Cases:** 12

---

## TC-008-001: Content Grid Display
**Steps:** 1) Navigate to content page  
**Expected:** Grid layout with thumbnails, titles, metadata  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-001.png`

## TC-008-002: Search Content - Found
**Steps:** 1) Enter search term matching content 2) Observe results  
**Expected:** Results filter in real-time, matching items shown  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-002.png`

## TC-008-003: Search Content - Not Found
**Steps:** 1) Enter search term with no matches  
**Expected:** Empty state: "No content found"  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-003.png`

## TC-008-004: Search Debouncing
**Steps:** 1) Type quickly in search 2) Check network requests  
**Expected:** Debounced (300ms), not querying every keystroke  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-004.png`

## TC-008-005: Clear Search
**Steps:** 1) Enter search term 2) Click "X" or clear button  
**Expected:** Search cleared, all content shown  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-005.png`

## TC-008-006: Filter by Type - Image
**Steps:** 1) Select "Image" filter  
**Expected:** Only images shown  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-006.png`

## TC-008-007: Filter by Type - Video
**Steps:** 1) Select "Video" filter  
**Expected:** Only videos shown  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-007.png`

## TC-008-008: Filter by Type - All
**Steps:** 1) Select "All" filter  
**Expected:** All content types shown  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-008.png`

## TC-008-009: Edit Content Button
**Steps:** 1) Click "Edit" on content item  
**Expected:** Edit modal opens with current data  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-009.png`

## TC-008-010: Update Content Title
**Steps:** 1) Edit title to "New Title" 2) Save  
**Expected:** Title updated, success toast  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-010.png`

## TC-008-011: Delete Content Button
**Steps:** 1) Click "Delete" on content  
**Expected:** Confirmation dialog appears  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-011.png`

## TC-008-012: Confirm Delete Content
**Steps:** 1) Confirm deletion  
**Expected:** Content removed from grid, file deleted  
**Evidence:** `.bmad/testing/evidence/story-008/TC-008-012.png`

---

**Summary:** 12 cases | 0 passed | 12 not run | Est: 35 min
