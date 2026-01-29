# Vizora UI Polish Checklist - Phase 1 (4 Weeks)

**Goal:** Fix all P0 UI issues before adding new features  
**Target Quality:** 8/10 (from current 4.3/10)  
**Effort:** 1 senior frontend developer, 4 weeks  

---

## WEEK 1: Content & Search

### Day 1-2: Search Bars Everywhere 🔍
- [ ] Add search to Content page (filter by title, type)
- [ ] Add search to Playlists page (filter by name)
- [ ] Add search to Devices page (filter by name, location)
- [ ] Implement debounced search (useDebounce hook)
- [ ] Add "X results found" feedback

**Files to modify:**
- `web/src/app/dashboard/content/page.tsx`
- `web/src/app/dashboard/playlists/page.tsx`
- `web/src/app/dashboard/devices/page.tsx`

---

### Day 3-4: Thumbnail Generation 🖼️
- [ ] Install `sharp` in middleware (image processing)
- [ ] Create thumbnail generation endpoint (`POST /api/content/:id/thumbnail`)
- [ ] Generate 300x300 thumbnails on upload
- [ ] Store thumbnail URL in database (`Content.thumbnailUrl`)
- [ ] Update Content card to show thumbnail instead of icon
- [ ] Add fallback to icon if thumbnail fails

**Files to modify:**
- `middleware/src/modules/content/content.service.ts` (add thumbnail logic)
- `packages/database/prisma/schema.prisma` (add `thumbnailUrl String?`)
- `web/src/app/dashboard/content/page.tsx` (display thumbnails)

---

### Day 5: Preview Modal 👁️
- [ ] Install `yet-another-react-lightbox`
- [ ] Create PreviewModal component
- [ ] Image preview (lightbox)
- [ ] Video preview (HTML5 player)
- [ ] PDF preview (iframe or PDF.js)
- [ ] Add "Preview" button to content cards
- [ ] Click card to preview

**Files to create:**
- `web/src/components/PreviewModal.tsx`

**Files to modify:**
- `web/src/app/dashboard/content/page.tsx`

---

## WEEK 2: Upload & Devices

### Day 1-2: Drag-and-Drop Upload 📤
- [ ] Install `react-dropzone`
- [ ] Replace file input with dropzone
- [ ] Support multi-file selection
- [ ] Show upload queue with progress
- [ ] Individual file progress bars
- [ ] Success/error per file
- [ ] Allow removing files from queue

**Files to modify:**
- `web/src/app/dashboard/content/page.tsx` (upload modal)

---

### Day 3: Device Table Polish 📊
- [ ] Make table columns sortable (click header)
- [ ] Add sort indicator (↑↓ arrows)
- [ ] Implement pagination (10/25/50 per page)
- [ ] Add page controls (prev/next, jump to page)
- [ ] Show "X-Y of Z devices"

**Files to modify:**
- `web/src/app/dashboard/devices/page.tsx`

**Consider:** Install `@tanstack/react-table` for advanced features

---

### Day 4-5: Currently Playing Indicator 📺
- [ ] Add `currentPlaylistId` join to device query
- [ ] Show playlist name in device table
- [ ] Add "Currently Playing: X" badge
- [ ] Update in real-time via WebSocket
- [ ] Add to playlist cards (show which devices)

**Files to modify:**
- `middleware/src/modules/displays/displays.service.ts` (join playlist)
- `web/src/app/dashboard/devices/page.tsx` (display playlist name)
- `web/src/app/dashboard/playlists/page.tsx` (show device count)

---

## WEEK 3: Playlists & Forms

### Day 1-2: Playlist Thumbnails & Ordering 🎬
- [ ] Generate composite thumbnail (first 4 content items)
- [ ] Install `@dnd-kit/core` for drag-and-drop
- [ ] Make playlist items draggable
- [ ] Update order on drop
- [ ] Visual feedback during drag
- [ ] Save new order to API

**Files to modify:**
- `web/src/app/dashboard/playlists/page.tsx` (builder modal)

---

### Day 3: Duration Editing ⏱️
- [ ] Add duration input to playlist items
- [ ] Inline editing (click to edit)
- [ ] Default to 30s
- [ ] Min 5s, max 300s validation
- [ ] Show total playlist duration

**Files to modify:**
- `web/src/app/dashboard/playlists/page.tsx` (item display)
- `middleware/src/modules/playlists/playlists.service.ts` (update duration)

---

### Day 4-5: Form Validation ✅
- [ ] Install `zod` for schema validation
- [ ] Add real-time validation to all forms
- [ ] Show inline error messages (not just toasts)
- [ ] Field-level validation on blur
- [ ] Disable submit if invalid
- [ ] Success/error states for inputs

**Files to modify:**
- All forms in `web/src/app/dashboard/*/page.tsx`

**Files to create:**
- `web/src/lib/validation.ts` (zod schemas)

---

## WEEK 4: Dashboard & Polish

### Day 1-2: Real-Time Activity Feed 📡
- [ ] Create ActivityFeed component
- [ ] Show last 10 events (device online, content uploaded, playlist changed)
- [ ] Update via WebSocket
- [ ] Add to dashboard homepage
- [ ] Timestamp for each event
- [ ] Click event to navigate

**Files to create:**
- `web/src/components/ActivityFeed.tsx`

**Files to modify:**
- `web/src/app/dashboard/page.tsx`
- `realtime/src/gateways/device.gateway.ts` (emit events)

---

### Day 3: Health Summary Cards 💚
- [ ] Count devices online/offline/error
- [ ] Show storage usage (X MB / quota)
- [ ] Content count by type
- [ ] Playlist count
- [ ] Display as stat cards on dashboard
- [ ] Color-coded (green/yellow/red)

**Files to modify:**
- `web/src/app/dashboard/page.tsx`
- `middleware/src/modules/dashboard/dashboard.controller.ts` (new endpoint)

---

### Day 4: Global Search 🔍
- [ ] Install `cmdk` (command palette library)
- [ ] Add Cmd+K / Ctrl+K shortcut
- [ ] Search across content, playlists, devices
- [ ] Show categorized results
- [ ] Click result to navigate
- [ ] Keyboard navigation

**Files to create:**
- `web/src/components/CommandPalette.tsx`

**Files to modify:**
- `web/src/app/layout.tsx` (add global shortcut)

---

### Day 5: Final Polish ✨
- [ ] Replace spinners with skeleton screens
- [ ] Add help tooltips (using `@radix-ui/react-tooltip`)
- [ ] Add retry buttons to error toasts
- [ ] Improve empty states (better copy, illustrations)
- [ ] Test all flows end-to-end
- [ ] Fix any visual bugs
- [ ] Responsive testing (mobile/tablet)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

---

## TESTING CHECKLIST (End of Week 4)

### Smoke Tests:
- [ ] Upload image → See thumbnail → Preview works
- [ ] Create playlist → Drag to reorder → Assign to device → Verify on device
- [ ] Search content → Find item → Push to device
- [ ] Pair device → See it online → View currently playing
- [ ] Dashboard shows real data (not placeholders)

### Performance:
- [ ] Content page loads in <2s with 100 items
- [ ] Search returns results in <200ms
- [ ] Drag-and-drop is smooth (60fps)
- [ ] No console errors or warnings

### UX:
- [ ] All actions have loading states
- [ ] All errors show helpful messages
- [ ] All forms validate in real-time
- [ ] Can navigate entire app with keyboard
- [ ] Mobile UI is usable (no horizontal scroll)

---

## DELIVERABLES (End of Phase 1)

### Code:
- [ ] All P0 UI features implemented
- [ ] No broken functionality
- [ ] Code reviewed and merged

### Documentation:
- [ ] Component library documented (Storybook optional)
- [ ] Design system guide (colors, spacing, typography)
- [ ] User testing notes

### Metrics:
- [ ] Time to upload 10 files: <2 min (from 5 min)
- [ ] Time to find content: <5 sec (from 30 sec)
- [ ] Time to create playlist: <2 min (from 3 min)
- [ ] Lighthouse score: 90+ (performance, accessibility)

---

## SUCCESS CRITERIA

**Before (Current):** 4.3/10 UX quality  
**After Phase 1:** 8/10 UX quality ✅

**User Feedback Target:**
- "This feels professional" ✅
- "I can find what I need quickly" ✅
- "Uploading is easy" ✅
- "I can see what's playing" ✅

---

## DEPENDENCIES & SETUP

### NPM Packages to Install:
```bash
# Week 1
pnpm add yet-another-react-lightbox

# Week 2
pnpm add react-dropzone

# Week 3
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm add zod

# Week 4
pnpm add cmdk
pnpm add @radix-ui/react-tooltip

# Backend
cd middleware
pnpm add sharp
```

### Database Migrations:
```bash
# Add thumbnailUrl to Content
cd packages/database
npx prisma migrate dev --name add_thumbnail_url
```

### Environment Setup:
```bash
# No new env vars needed for Phase 1
```

---

## ROLLOUT PLAN

### Week 4, Day 5: Deploy to Staging
- [ ] Run full test suite
- [ ] Deploy to staging environment
- [ ] Invite 5-10 beta testers

### Week 5: User Testing
- [ ] Gather feedback from beta testers
- [ ] Fix critical bugs
- [ ] Make UX adjustments

### Week 6: Production Deploy
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Announce to existing users

---

## TEAM ASSIGNMENTS

**Frontend Developer (Primary):**
- All UI implementation
- Component creation
- Form validation
- Testing

**Backend Developer (Support, ~20%):**
- Thumbnail generation endpoint
- Dashboard stats endpoint
- WebSocket event emission

**Designer (Optional, ~10%):**
- Review UI changes
- Suggest improvements
- Create better empty state illustrations

**QA (Optional, ~20%):**
- End-to-end testing
- Cross-browser testing
- Accessibility testing

---

## COMMUNICATION PLAN

**Daily Standups:**
- What I completed yesterday
- What I'm working on today
- Any blockers

**Weekly Demo (Friday):**
- Show progress to stakeholders
- Get feedback
- Adjust priorities if needed

**End of Week 4:**
- Full demo of all P0 fixes
- User testing session
- Go/no-go decision for Phase 2

---

## RISKS & MITIGATION

### Risk 1: Scope Creep
**Mitigation:** Stick to P0 only. Park any P1/P2 requests for Phase 2.

### Risk 2: Performance Issues
**Mitigation:** Test with large datasets (100+ items). Optimize early.

### Risk 3: Breaking Existing Features
**Mitigation:** Regression test after each change. Keep feature flags if needed.

### Risk 4: Library Conflicts
**Mitigation:** Test new libraries in isolation before integrating.

---

## POST-PHASE 1: NEXT STEPS

Once Phase 1 is complete (4 weeks):

**Option A: Launch Beta**
- Deploy to production
- Invite early adopters
- Gather feedback before Phase 2

**Option B: Continue to Phase 2**
- Start P1 features immediately
- Launch after 6 more weeks (10 weeks total)

**Recommendation:** Option A (beta launch) to validate UX improvements before investing in P1 features.

---

**Phase 1 Kickoff:** Ready to start!  
**Target Completion:** 4 weeks from kickoff  
**Next Phase:** P1 features (6 weeks) or Beta launch + feedback

---

*Created by: Mango 🥭*  
*Date: 2026-01-28*  
*Status: Ready for review & approval*
