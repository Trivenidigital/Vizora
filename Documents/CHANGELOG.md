# Vizora Platform - Changelog

All notable changes to the Vizora platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added (2026-01-28)

#### BMAD Structure & Testing Framework ✅ COMPLETE
- ✅ Created comprehensive BMAD testing structure
- ✅ Sprint tracker with 27 stories identified and tracked
- ✅ Manual test plan (150+ test cases, 4-5h execution)
- ✅ **27 story files created** - All stories fully documented
- ✅ Test case documentation for P0 Quick Wins (25 cases)
- ✅ Evidence capture framework
- ✅ Bug tracking system
- ✅ Testing phase deliverables defined
- ✅ Quick reference guides (READY_FOR_TESTING.md, STATUS_SUMMARY.md)
- ✅ Test report template

#### P0 Quick Wins - UI Polish Package (Story-021)
- ✅ **Inline Validation Errors** - Field-level error display for forms
  - New component: `FieldError.tsx`
  - New helper: `extractFieldErrors()` in validation.ts
  - Applied to: Login, content upload, device edit forms
  
- ✅ **Thumbnail Generation** - Automatic thumbnail creation on image upload
  - Integrated with existing ThumbnailService (sharp.js)
  - Auto-generates 300x300 thumbnails
  - Displays in content grid (replaces emoji icons)
  
- ✅ **Content Preview Modal** - Full-screen content preview
  - New component: `PreviewModal.tsx`
  - Support for: Images (with zoom), Videos, PDFs (sandboxed), URLs
  - ESC key to close
  - Security: Sandbox attribute on PDFs, noopener on external links
  
- ✅ **Visual Playlist Thumbnails** - 2x2 grid preview of playlist content
  - Shows first 4 content items
  - CSS Grid layout (not Canvas)
  - Lazy loading for performance
  - Emoji fallback for empty playlists

#### Security Enhancements
- ✅ **File Size Limit** - 50MB max for thumbnail generation (DoS protection)
- ✅ **PDF Sandbox** - XSS protection on PDF preview
- ✅ **External Link Security** - noopener noreferrer attributes

#### Performance Optimizations
- ✅ **Lazy Loading** - Images load on scroll (reduces initial load)
- ✅ **Client-Side Pagination** - Works for <5,000 items
- ✅ **Debounced Search** - Prevents excessive API calls

### Fixed (2026-01-28)

- ✅ Inline validation now shows field-level errors (not just toasts)
- ✅ Thumbnail generation integrated into upload flow
- ✅ Preview modal security hardened (sandbox, noopener)

### Changed (2026-01-28)

- Content grid now shows thumbnails instead of emoji icons
- Playlist cards show visual 2x2 thumbnail grids
- Forms show inline errors in addition to toast notifications

---

## [0.9.0] - 2026-01-27

### Added

#### Core Platform Features
- ✅ User authentication (register, login, logout)
- ✅ Organization multi-tenancy
- ✅ Device pairing flow (QR code entry)
- ✅ Device management (list, edit, delete, unpair)
- ✅ Device status monitoring (online/offline, heartbeat)
- ✅ Currently playing indicator on devices

#### Content Management
- ✅ Content upload (image, video, PDF, URL)
- ✅ Content library with grid view
- ✅ Content type filtering
- ✅ Content search (debounced)
- ✅ Content edit/delete
- ✅ Multi-file bulk upload
- ✅ Drag-and-drop upload zone

#### Playlist Management
- ✅ Playlist creation with name/description
- ✅ Playlist item management
- ✅ Drag-and-drop reordering (@dnd-kit)
- ✅ Duration editing per item
- ✅ Playlist assignment to devices

#### Realtime & Push
- ✅ WebSocket communication (realtime service)
- ✅ Instant content push to devices
- ✅ Device heartbeat monitoring
- ✅ Playlist update notifications

#### UI Features (Already Working)
- ✅ Sortable table columns (devices)
- ✅ Pagination controls (10/25/50/100 per page)
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Toast notifications
- ✅ Modal dialogs
- ✅ Loading spinners
- ✅ Empty states with CTAs

### Fixed (2026-01-27)

- ✅ Login token extraction (cookie + localStorage)
- ✅ Playlist assignment 404 error
- ✅ Realtime HTTP endpoints (/api prefix)
- ✅ Middleware stability (error handlers)
- ✅ Device pairing API mismatch (nickname→name)
- ✅ Content upload 400 error (title→name mapping)
- ✅ Display app infinite polling after pairing

### Known Issues

- ⚠️ Performance testing incomplete (PowerShell jobs invalid)
- ⚠️ Load testing needed (Artillery/k6 required)
- ⚠️ Automated test coverage: ~40%
- ⚠️ Manual testing in progress

---

## Testing Status

### Completed Testing
- ✅ E2E test suite: 92.11% pass rate (35/38 tests)
- ✅ Authentication: 100% pass (7/7 tests)
- ✅ Organizations: 100% pass (3/3 tests)
- ✅ Playlists: 100% pass (6/6 tests)
- ✅ Displays: 100% pass (7/7 tests)
- ✅ WebSocket: 80% pass (20/25 tests)

### Pending Testing
- ⏳ Manual test plan (150+ test cases)
- ⏳ P0 Quick Wins validation (25 test cases)
- ⏳ Cross-browser testing
- ⏳ Performance testing
- ⏳ Load testing
- ⏳ Security audit

---

## Migration Notes

### From 0.8.x to 0.9.0
- No breaking changes
- Database migrations applied automatically

### From 0.9.0 to Unreleased
- No breaking changes
- P0 Quick Wins are additive (no API changes)

---

## Deployment Checklist

### Before Deploying Unreleased
- [ ] Execute manual test plan
- [ ] Verify all P0 test cases pass
- [ ] Document bugs found
- [ ] Fix critical bugs (P0)
- [ ] Update test report
- [ ] Smoke test in staging
- [ ] Backup database
- [ ] Deploy to production
- [ ] Verify deployment
- [ ] Monitor logs for 24h

---

## Contributors

- Development: Mango 🥭
- Testing: Pending manual execution
- Product: Based on Vizora PRD
- Architecture: Based on tech-specs

---

## Links

- **Documentation:** `PRD/` folder
- **Tech Specs:** `_bmad-output/implementation-artifacts/`
- **Test Plan:** `.bmad/testing/manual-test-plan.md`
- **Sprint Tracker:** `.bmad/sprint-current.md`
- **Bug Reports:** `.bmad/testing/bugs/`

---

**Last Updated:** 2026-01-28 21:35:00
