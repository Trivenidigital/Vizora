# Vizora Platform - Manual Test Plan

**Date Created:** 2026-01-28  
**Test Lead:** Mango 🥭  
**Sprint:** Testing & QA Sprint  
**Baseline Commit:** `8142493bb25d86a6c3bcbf9304c39712d481de18`

---

## Executive Summary

**Scope:** Comprehensive manual testing of entire Vizora platform  
**Duration:** 4 hours (estimated)  
**Stories:** 27 total  
**Test Cases:** ~150 estimated  
**Focus Areas:** P0 Quick Wins + Core Platform Features

---

## Test Environment

### Services Required
- ✅ Middleware (port 3000) - Backend API
- ✅ Web App (port 3001) - Frontend
- ✅ Realtime (port 3002) - WebSocket service
- ✅ Display App (Electron) - Display client
- ✅ Redis - Session & cache storage
- ✅ PostgreSQL - Database

### Test Data Requirements
- Clean database (or test org)
- Sample content files:
  - Images: JPEG, PNG, GIF (various sizes: <1MB, 5MB, >50MB)
  - Videos: MP4 (various durations: 10s, 30s, 2min)
  - PDFs: Sample documents
  - URLs: External website links
- Test user accounts:
  - Admin user
  - Manager user (if RBAC exists)
  - Viewer user (if RBAC exists)

### Test Browser
- Primary: Chrome (latest)
- Secondary: Firefox (if time permits)
- Test in:
  - Desktop (1920x1080)
  - Tablet (768px width)
  - Mobile (375px width)

### MCP Servers Available

**Note:** This environment doesn't have MCP servers configured. Testing will use:
- Manual browser interaction
- DevTools Console for errors
- Network tab for API calls
- Screenshots via OS tools

---

## Test Scope

### Phase 1: Authentication & Setup (30 min)
**Stories:** 001, 002, 003  
**Priority:** P0  
**Focus:** User can register, login, and access platform

**Test Cases:**
- Registration with valid data
- Registration validation (email, password rules)
- Login success/failure
- Session persistence
- Logout
- Organization multi-tenant isolation

---

### Phase 2: Device Management (45 min)
**Stories:** 004, 005, 006  
**Priority:** P0  
**Focus:** Device pairing, monitoring, management

**Test Cases:**
- Generate pairing code
- Pair display app with code
- Device appears in list
- Device status updates (online/offline)
- Currently playing indicator shows playlist
- Edit device (nickname, location)
- Delete device
- Unpair device
- Sortable columns (name, status, location, last seen)
- Pagination (10/25/50/100 items per page)

---

### Phase 3: Content Management (60 min)
**Stories:** 007, 008, 009, 010, 021  
**Priority:** P0  
**Focus:** Upload, manage, preview content + UI polish

**Test Cases:**

**Upload:**
- Upload image (JPEG, PNG, GIF)
- Upload video (MP4)
- Upload PDF
- Add URL content
- Thumbnail generation after upload
- File size validation (>50MB rejected)
- Multi-file bulk upload

**Management:**
- Content grid displays thumbnails
- Search content
- Filter by type (image/video/pdf/url)
- Edit content (title, URL)
- Delete content
- Sortable content list
- Pagination

**Preview:**
- Preview image (click-to-zoom)
- Preview video (with controls)
- Preview PDF (embedded, sandboxed)
- Preview URL (external link)
- ESC key closes preview
- Click outside closes preview

---

### Phase 4: Playlist Management (45 min)
**Stories:** 011, 012, 013, 014, 021  
**Priority:** P0  
**Focus:** Create, edit, manage playlists + visual thumbnails

**Test Cases:**

**Creation:**
- Create playlist with name + description
- Add content items to playlist
- Drag-and-drop reorder items
- Edit item duration inline
- Remove items from playlist
- Save playlist

**Management:**
- Playlist list shows all playlists
- Search playlists
- Visual 2x2 thumbnail grid for each playlist
- Currently playing indicator (shows # of devices)
- Edit playlist (name, description, items)
- Delete playlist
- Duplicate playlist (if exists)

**Validation:**
- Duration editing saves correctly
- Drag-drop order persists after reload
- Lazy loading prevents performance issues

---

### Phase 5: Content Push & Realtime (30 min)
**Stories:** 018, 019, 020  
**Priority:** P0  
**Focus:** Instant content delivery to displays

**Test Cases:**
- Push content directly to device
- Content appears on display immediately
- Assign playlist to device
- Playlist starts playing on display
- Device heartbeat updates "last seen"
- WebSocket connection stable
- Multiple devices receive updates
- Content updates push in <1 second

---

### Phase 6: Scheduling (30 min)
**Stories:** 015, 016, 017  
**Priority:** P1  
**Focus:** Schedule playlists for specific times

**Test Cases:**
- Create schedule (name, date range, time range)
- Assign schedule to device
- Assign schedule to device group
- Schedule conflicts handled
- Priority system works
- Active schedule indicator
- Edit schedule
- Delete schedule

---

### Phase 7: Display Application (20 min)
**Stories:** 025, 026, 027  
**Priority:** P0  
**Focus:** Electron display app functionality

**Test Cases:**
- Display app launches
- Pairing code entry
- Pairing succeeds
- Content renders correctly (image/video)
- Playlist plays in order
- Transitions between items
- Heartbeat sent to server
- WebSocket reconnection on disconnect

---

### Phase 8: UI/UX Validation (20 min)
**Stories:** 021, 022, 023, 024  
**Priority:** P0  
**Focus:** P0 Quick Wins validation

**Test Cases:**
- All forms show inline validation errors
- Login form validation
- Content upload validation
- Device edit validation
- Errors clear on blur when fixed
- Toast notifications don't duplicate with inline errors

---

### Phase 9: Cross-Module Integration (30 min)
**Priority:** P0  
**Focus:** End-to-end workflows

**Test Cases:**

**Workflow 1: Complete Signage Setup**
1. Register account
2. Pair display device
3. Upload content
4. Create playlist
5. Assign playlist to device
6. Verify content displays

**Workflow 2: Content Update**
1. Upload new content
2. Add to existing playlist
3. Push to devices
4. Verify update in <1 second

**Workflow 3: Schedule Management**
1. Create morning/evening playlists
2. Schedule morning playlist (6am-12pm)
3. Schedule evening playlist (12pm-11pm)
4. Verify correct playlist plays at correct time

---

## Edge Cases & Negative Testing

### File Upload
- [ ] Upload 0-byte file
- [ ] Upload 51MB file (should reject)
- [ ] Upload non-image as image type
- [ ] Upload corrupt file
- [ ] Upload with special characters in filename

### Forms
- [ ] Submit empty forms
- [ ] XSS attempts in text fields
- [ ] SQL injection attempts
- [ ] Very long strings (1000+ chars)
- [ ] Special characters and unicode

### Concurrency
- [ ] Two users editing same playlist
- [ ] Device connects while being edited
- [ ] Content deleted while in use

### Performance
- [ ] 100+ content items
- [ ] 50+ playlists
- [ ] 20+ devices
- [ ] Rapid page navigation
- [ ] Slow network simulation

---

## Browser Compatibility

**Primary (Full Test):**
- Chrome (latest) - Desktop

**Secondary (Smoke Test):**
- Firefox (latest) - Desktop
- Safari (if Mac available)

**Responsive (Smoke Test):**
- Tablet view (768px)
- Mobile view (375px)

---

## Test Execution Order

1. **Setup** (10 min)
   - Start all services
   - Create test organization
   - Prepare test data

2. **Core Features** (2h 30min)
   - Authentication → Devices → Content → Playlists

3. **Advanced Features** (1h)
   - Push & Realtime → Scheduling → Display App

4. **Polish & Integration** (30 min)
   - UI/UX validation → End-to-end workflows

5. **Edge Cases** (30 min)
   - Negative testing → Performance testing

6. **Cleanup & Report** (30 min)
   - Screenshot organization
   - Bug documentation
   - Test report generation

---

## Success Criteria

**Pass Criteria:**
- All P0 test cases pass (0 critical bugs)
- <5 P1 bugs (high priority, non-blocking)
- <10 P2 bugs (medium priority, polish issues)
- All core workflows complete successfully
- Performance acceptable (<3s page loads)

**Conditional Pass:**
- 1-2 P0 bugs with known workarounds
- <10 P1 bugs
- Performance degradation in edge cases only

**Fail:**
- 3+ P0 bugs
- Core workflow broken
- Data loss possible
- Security vulnerabilities

---

## Deliverables

1. **Test Cases** - `.bmad/testing/test-cases/story-*.md`
2. **Evidence** - Screenshots in `.bmad/testing/evidence/story-*/`
3. **Bug Reports** - `.bmad/testing/bugs/bug-*.md`
4. **Test Report** - `.bmad/testing/test-report-2026-01-28.md`
5. **Updated Artifacts** - Sprint tracker, story files, CHANGELOG

---

## Risk Mitigation

**High Risk Areas:**
- WebSocket stability (test reconnection)
- File upload (test size limits, validation)
- Multi-tenancy (test data isolation)
- Real-time updates (test latency)

**Mitigation:**
- Focused testing on risky areas
- Multiple test scenarios per risk
- Performance monitoring during tests
- Security-focused negative testing

---

## Notes

- Clear browser cache between test runs
- Use incognito for fresh sessions
- Monitor console for errors throughout
- Save evidence as you go (don't wait)
- Document unexpected behavior immediately

---

**Test Plan Approved:** 2026-01-28  
**Ready to Execute:** YES ✅  
**Estimated Duration:** 4-5 hours
