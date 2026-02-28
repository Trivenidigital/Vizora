# Validation Rules Catalog

30 rules across 6 categories. Each rule has a unique ID, severity level, and automated check.

## Severity Definitions

| Severity | Meaning | Deploy? |
|----------|---------|---------|
| **Critical** | Will cause visible failure on customer displays (blank screens, broken content, errors) | NO — must fix first |
| **Warning** | Suboptimal but won't break displays (stale content, approaching limits, inefficiencies) | Yes, but review |
| **Info** | Housekeeping items (orphaned content, missing metadata, unused resources) | Yes |

---

## Content Rules (C-001 to C-007)

### C-001: Invalid Content URL
- **Severity**: Critical
- **Check**: Content URL matches one of: `minio://`, `http(s)://`, `/uploads/`
- **Why**: Invalid URLs cause 404/blank on displays
- **Fix**: Re-upload content or fix the URL

### C-002: Expired but Active Content
- **Severity**: Warning
- **Check**: `expiresAt < now() AND status = 'active'`
- **Why**: Expired content may show outdated information
- **Fix**: Archive expired content or extend expiration

### C-003: Orphaned Content
- **Severity**: Info
- **Check**: Content not referenced by any playlist
- **Why**: Wastes storage, clutters dashboard
- **Fix**: Add to a playlist or archive

### C-004: Missing Thumbnail
- **Severity**: Info
- **Check**: Image/video content with no `thumbnailUrl`
- **Why**: Dashboard shows broken preview
- **Fix**: Re-upload or trigger thumbnail generation

### C-005: Type/MIME Mismatch
- **Severity**: Warning
- **Check**: Content `type` doesn't match `mimeType` prefix (e.g., type=image but mime=video/mp4)
- **Why**: Display may render incorrectly
- **Fix**: Update type or re-upload with correct format

### C-006: Zero Duration
- **Severity**: Warning
- **Check**: `duration <= 0` for non-URL content
- **Why**: Content will flash or be skipped in playlist rotation
- **Fix**: Set minimum 1-second duration

### C-007: Oversized File
- **Severity**: Warning
- **Check**: Image >10MB or video >100MB
- **Why**: Slow download to displays, buffering, memory pressure
- **Fix**: Compress or transcode

---

## Layout Rules (L-001 to L-003)

### L-001: Empty Layout Zone
- **Severity**: Critical
- **Check**: Zone has no contentId, playlistId, or widgetType
- **Why**: That area of the display will be blank
- **Fix**: Assign content to the zone

### L-002: Zone References Deleted Content
- **Severity**: Critical
- **Check**: Zone references content that no longer exists (resolve error)
- **Why**: Zone will show error or blank
- **Fix**: Update zone to reference valid content

### L-003: All Zones Empty
- **Severity**: Critical
- **Check**: Every zone in the layout has no assignment
- **Why**: Entire display will be blank
- **Fix**: Assign content to at least one zone

---

## Display Rules (D-001 to D-006)

### D-001: No Content Source
- **Severity**: Critical
- **Check**: No `currentPlaylistId` AND no active schedules targeting this display
- **Why**: Display will show blank/default screen
- **Fix**: Assign a playlist or create a schedule

### D-002: Stale Offline Display
- **Severity**: Warning
- **Check**: `status != 'online'` AND `lastHeartbeat > 24h ago`
- **Why**: Display may be powered off, disconnected, or failed
- **Fix**: Check network/power at the display location

### D-003: Missing Resolution
- **Severity**: Info
- **Check**: No resolution field configured
- **Why**: Content may not render at optimal quality
- **Fix**: Set display resolution in settings

### D-004: Orientation Mismatch
- **Severity**: Warning
- **Check**: Display orientation doesn't match content orientation
- **Why**: Content will appear rotated or stretched
- **Fix**: Ensure content matches display orientation
- **Note**: Deferred — requires content metadata cross-reference

### D-005: Empty Playlist Assigned
- **Severity**: Critical
- **Check**: `currentPlaylistId` references a playlist with 0 items
- **Why**: Display will show nothing
- **Fix**: Add items to the playlist or assign a different one

### D-006: Display in Error State
- **Severity**: Critical
- **Check**: `status = 'error'` or `error` field is non-empty
- **Why**: Display is reporting a failure
- **Fix**: Investigate error, restart or re-pair

---

## Playlist Rules (P-001 to P-003)

### P-001: Empty Playlist
- **Severity**: Warning (if assigned) / Info (if unassigned)
- **Check**: Playlist has 0 items
- **Why**: Assigned empty playlist = blank screen
- **Fix**: Add content items

### P-002: Archived Content in Playlist
- **Severity**: Warning
- **Check**: Playlist item references content with `status = 'archived'`
- **Why**: Archived content may not render or show stale data
- **Fix**: Remove archived items from playlist

### P-003: Expired Content in Playlist
- **Severity**: Warning
- **Check**: Playlist item content has `expiresAt < now()`
- **Why**: Expired content may show outdated information
- **Fix**: Remove or replace expired items

---

## Schedule Rules (S-001 to S-008)

### S-001: Overlapping Schedules
- **Severity**: Info
- **Check**: Two active schedules for the same display overlap in date range, days-of-week, and time range
- **Why**: Priority resolution may not match expectations
- **Fix**: Review priorities or adjust time ranges

### S-002: Display Without Schedule or Playlist
- **Severity**: Warning
- **Check**: Display has no `currentPlaylistId` and no schedules
- **Why**: Display has no content source at all
- **Fix**: Create a schedule or assign a default playlist

### S-003: Active Schedule Past End Date
- **Severity**: Warning
- **Check**: `isActive = true` AND `endDate < now()`
- **Why**: Schedule is stale, clutters the system
- **Fix**: Deactivate or delete

### S-004: Schedule Targets Nonexistent Display
- **Severity**: Critical
- **Check**: `displayId` references a display not found in the system
- **Why**: Schedule will never trigger
- **Fix**: Update target or delete schedule

### S-005: Coverage Gaps
- **Severity**: Info
- **Check**: Time slots with no schedule and no default playlist
- **Why**: Display shows nothing during unscheduled periods
- **Fix**: Add a default playlist or extend schedule coverage
- **Note**: Complex to compute — deferred to future version

### S-006: Schedule With Empty Playlist
- **Severity**: Warning
- **Check**: Schedule's `playlistId` references a playlist with 0 items
- **Why**: Scheduled time slot will show nothing
- **Fix**: Add content to the playlist

### S-007: Midnight-Crossing Schedule
- **Severity**: Warning
- **Check**: `startTime > endTime` (e.g., 23:00 → 02:00)
- **Why**: Time comparison logic may not handle midnight crossing
- **Fix**: Split into two schedules (before and after midnight)

### S-008: Same-Priority Collision
- **Severity**: Warning
- **Check**: Overlapping schedules with identical priority values
- **Why**: Non-deterministic resolution — display may flip between content
- **Fix**: Set different priorities

---

## Storage Rules (ST-001 to ST-002)

### ST-001: Storage Warning
- **Severity**: Warning
- **Check**: Organization storage usage >80%
- **Why**: Approaching quota limit, uploads may fail soon
- **Fix**: Archive old content or increase quota

### ST-002: Storage Exceeded
- **Severity**: Critical
- **Check**: Organization storage usage >100%
- **Why**: New uploads will fail
- **Fix**: Delete unused content immediately or increase quota

---

## Summary

| Category | Rules | Critical | Warning | Info |
|----------|-------|----------|---------|------|
| Content | C-001 to C-007 | 1 | 4 | 2 |
| Layout | L-001 to L-003 | 3 | 0 | 0 |
| Display | D-001 to D-006 | 3 | 2 | 1 |
| Playlist | P-001 to P-003 | 0 | 3 | 0 |
| Schedule | S-001 to S-008 | 2 | 4 | 2 |
| Storage | ST-001 to ST-002 | 1 | 1 | 0 |
| **Total** | **30 rules** | **10** | **14** | **5** |
