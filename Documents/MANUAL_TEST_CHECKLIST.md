# 📋 Manual Testing Checklist - Complete E2E Verification

**Purpose:** Test every user workflow to find all bugs before claiming "production ready"  
**Started:** 2026-01-27 10:40 PM EST  
**Tester:** Autonomous testing + User verification  

---

## 🚦 Services Status

Before starting, verify all services are running:

```powershell
# Check all ports
Test-NetConnection localhost -Port 3000  # Middleware ✅
Test-NetConnection localhost -Port 3001  # Web App ✅
Test-NetConnection localhost -Port 3002  # Realtime ✅

# Check Redis
redis-cli ping  # Should return PONG ✅
```

**All services confirmed running:** ✅

---

## Test Session 1: Fresh User Journey

### 1. Registration Flow
- [ ] Navigate to http://localhost:3001
- [ ] Click "Register" or "Sign Up"
- [ ] **Test:** Fill form with valid data
  - [ ] Email: test-[timestamp]@test.com
  - [ ] Password: Test123!@#
  - [ ] Organization: Test Org
  - [ ] First Name: Test
  - [ ] Last Name: User
- [ ] **Expected:** Success message, auto-login, redirect to dashboard
- [ ] **Check:** Browser console for errors
- [ ] **Check:** Network tab shows 201 Created
- [ ] **Verify:** Token saved in localStorage
- [ ] **Verify:** Cookie set

**Edge Cases to Test:**
- [ ] Invalid email format
- [ ] Weak password (< 8 chars)
- [ ] Password without numbers
- [ ] Password without uppercase
- [ ] Duplicate email
- [ ] Missing required fields
- [ ] XSS attempt: `<script>alert('xss')</script>` in name

**Result:** 
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 2. Login Flow  
- [ ] Logout from dashboard
- [ ] Click "Login"
- [ ] **Test:** Enter credentials from registration
- [ ] **Expected:** Success message, redirect to dashboard
- [ ] **Check:** Console for errors
- [ ] **Check:** Network tab shows 200 OK
- [ ] **Verify:** Token refreshed
- [ ] **Verify:** Dashboard loads with user info

**Edge Cases:**
- [ ] Wrong password
- [ ] Non-existent email
- [ ] Empty fields
- [ ] SQL injection attempt: `admin' OR '1'='1`
- [ ] Rate limit (try 10 wrong passwords rapidly)

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 3. Dashboard Access
- [ ] After login, verify dashboard loads
- [ ] **Check:** All nav items visible
  - [ ] Dashboard
  - [ ] Content
  - [ ] Playlists
  - [ ] Displays
  - [ ] Schedules
  - [ ] Reports (if exists)
  - [ ] Settings
- [ ] **Check:** User info displayed correctly (top right)
- [ ] **Check:** Organization name shown
- [ ] **Check:** No console errors
- [ ] **Check:** All API calls succeed (Network tab)

**Dashboard Cards/Stats:**
- [ ] Content count shows
- [ ] Displays count shows
- [ ] Playlists count shows
- [ ] All numbers accurate

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 4. Content Upload - Image
- [ ] Navigate to Content Library
- [ ] Click "Upload Content" button
- [ ] **Test:** Upload an image file
  - File: Any .jpg or .png
  - Title: "Test Image 1"
  - Type: Should auto-detect as "image"
- [ ] **Expected:** Upload progress shown
- [ ] **Expected:** Success toast message
- [ ] **Expected:** Content appears in list
- [ ] **Check:** Thumbnail shows correctly
- [ ] **Check:** Metadata correct (type, size, etc.)
- [ ] **Check:** Console for errors

**Edge Cases:**
- [ ] Very large image (> 10MB)
- [ ] Invalid file type (.txt, .exe)
- [ ] XSS in title: `<img src=x onerror=alert(1)>`
- [ ] Empty title
- [ ] Special characters in title: `Test!@#$%^&*()`

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 5. Content Upload - Video
- [ ] Click "Upload Content"
- [ ] **Test:** Upload a video file
  - File: .mp4 or .webm
  - Title: "Test Video 1"
- [ ] **Expected:** Upload succeeds
- [ ] **Expected:** Type shows as "video"
- [ ] **Expected:** Duration detected (if possible)
- [ ] **Check:** Can play preview

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 6. Content Upload - URL
- [ ] Click "Upload Content"
- [ ] **Test:** Add URL content
  - URL: https://example.com
  - Title: "Test Website"
  - Type: Select "url"
- [ ] **Expected:** URL validated
- [ ] **Expected:** Content created
- [ ] **Expected:** Shows in list with globe icon

**Edge Cases:**
- [ ] Invalid URL (no protocol)
- [ ] Non-existent URL
- [ ] XSS in URL: `javascript:alert(1)`

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 7. Content Management
- [ ] **Edit Content:**
  - [ ] Click edit on a content item
  - [ ] Change title
  - [ ] Save
  - [ ] Verify change reflected

- [ ] **Delete Content:**
  - [ ] Click delete on a content item
  - [ ] Confirm deletion
  - [ ] Verify removed from list
  - [ ] Verify can't access by direct URL

- [ ] **Archive Content:**
  - [ ] Archive a content item
  - [ ] Verify not shown in active list
  - [ ] Filter to show archived
  - [ ] Verify appears in archived view

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 8. Playlist Creation
- [ ] Navigate to Playlists
- [ ] Click "Create Playlist"
- [ ] **Test:** Create new playlist
  - Name: "Test Playlist 1"
  - Description: "Test playlist for QA"
- [ ] **Expected:** Playlist created
- [ ] **Expected:** Empty playlist shown
- [ ] **Check:** Console for errors

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 9. Add Items to Playlist
- [ ] Open the test playlist created above
- [ ] Click "Add Content"
- [ ] **Test:** Add content items
  - [ ] Add Test Image 1 (duration: 10 seconds)
  - [ ] Add Test Video 1 (duration: 30 seconds)
  - [ ] Add Test Website (duration: 15 seconds)
- [ ] **Expected:** All 3 items added
- [ ] **Expected:** Order shown correctly
- [ ] **Expected:** Durations saved

**Test Reordering:**
- [ ] Drag items to reorder
- [ ] Save
- [ ] Refresh page
- [ ] Verify order persisted

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 10. Device Pairing (CRITICAL)
- [ ] Navigate to Displays
- [ ] Click "Add Display" or "Pair Device"
- [ ] **Test:** Device pairing flow
  - [ ] Enter device name: "Test Display 1"
  - [ ] Enter location: "Test Room"
  - [ ] Click "Generate Pairing Code"
  - [ ] **Expected:** Pairing code shown (6 digits)
  - [ ] **Expected:** QR code shown (if applicable)

**On Display App:**
- [ ] Open Display App (Electron)
- [ ] Should show pairing screen
- [ ] Enter the 6-digit code from web app
- [ ] Click "Pair"
- [ ] **Expected:** "Pairing successful" message
- [ ] **Expected:** Display app connects via WebSocket
- [ ] **Expected:** Shows "Connected" status

**Back to Web App:**
- [ ] Refresh displays page
- [ ] **Expected:** New display shows "Online" status
- [ ] **Expected:** Green indicator
- [ ] **Expected:** Last heartbeat timestamp

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 11. Content Push to Device (CRITICAL - THIS WAS BROKEN)
- [ ] Navigate to Content Library
- [ ] Find "Test Image 1"
- [ ] Click "Push" button
- [ ] **Test:** Push content to device
  - [ ] Select "Test Display 1" (should show as online)
  - [ ] Click "Push to 1 Device(s)"
  - [ ] **Expected:** Success toast message
  - [ ] **Expected:** No console errors

**On Display App:**
- [ ] Watch the display screen
- [ ] **Expected:** Image appears within 3 seconds ⏱️
- [ ] **Expected:** Image fills screen correctly
- [ ] **Expected:** No black screen
- [ ] **Expected:** Display app console shows "Received playlist update"

**Check Logs:**
- [ ] **Web app console:** Shows PATCH /api/displays/:id call
- [ ] **Middleware terminal:** Shows "Notified realtime service"
- [ ] **Realtime terminal:** Shows "Sent playlist update to device"
- [ ] **Display console:** Shows "Received playlist update"

**If it fails:**
- [ ] Check WebSocket connection status
- [ ] Check if device is actually online
- [ ] Check middleware logs for errors
- [ ] Check realtime logs for HTTP request
- [ ] Check display console for WebSocket messages

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 12. Playlist Assignment to Device
- [ ] Navigate to Displays
- [ ] Click on "Test Display 1"
- [ ] **Test:** Assign playlist
  - [ ] Find "Current Playlist" dropdown
  - [ ] Select "Test Playlist 1"
  - [ ] Click "Save" or "Update"
  - [ ] **Expected:** Success message
  - [ ] **Expected:** Playlist assigned

**On Display App:**
- [ ] **Expected:** Playlist starts playing within 3 seconds
- [ ] **Expected:** First item (Test Image 1) shows for 10 seconds
- [ ] **Expected:** Transitions to second item (Test Video 1)
- [ ] **Expected:** Video plays for 30 seconds
- [ ] **Expected:** Transitions to third item (Test Website)
- [ ] **Expected:** Website loads in iframe for 15 seconds
- [ ] **Expected:** Loops back to first item

**Verify Timing:**
- [ ] Use stopwatch to verify durations match

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 13. Schedule Creation
- [ ] Navigate to Schedules
- [ ] Click "Create Schedule"
- [ ] **Test:** Create time-based schedule
  - Name: "Business Hours Schedule"
  - Playlist: "Test Playlist 1"
  - Displays: Select "Test Display 1"
  - Start Time: 09:00 AM
  - End Time: 05:00 PM
  - Days: Monday-Friday
- [ ] **Expected:** Schedule created
- [ ] **Expected:** Shows in schedules list
- [ ] **Expected:** Status shows "Active" or "Pending"

**Test Activation:**
- [ ] Change system time to within schedule window (if possible)
- [ ] OR wait until actual schedule time
- [ ] **Expected:** Playlist automatically switches on display
- [ ] **Expected:** Reverts after end time

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 14. Display Management
- [ ] Navigate to Displays
- [ ] Click on "Test Display 1"
- [ ] **Test Edit:**
  - [ ] Change name to "Test Display Updated"
  - [ ] Change location to "Conference Room"
  - [ ] Save
  - [ ] Verify changes reflected

- [ ] **Test Status:**
  - [ ] Verify "Online" status shows
  - [ ] Verify last heartbeat updates every ~15 seconds
  - [ ] Close Display App
  - [ ] Wait 30 seconds
  - [ ] Refresh displays page
  - [ ] **Expected:** Status changes to "Offline"
  - [ ] **Expected:** Red/gray indicator

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 15. Multi-Tenant Isolation (SECURITY)
- [ ] **Create Second Organization:**
  - [ ] Logout
  - [ ] Register new user (different email)
  - [ ] Login as new user
  - [ ] Upload content
  - [ ] Create playlist

- [ ] **Test Isolation:**
  - [ ] Verify can't see first org's content
  - [ ] Verify can't see first org's playlists
  - [ ] Verify can't see first org's displays
  - [ ] Try to access first org's content by direct URL
  - [ ] **Expected:** 404 or 403 Forbidden
  - [ ] **Expected:** No data leakage

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 16. Error Handling
**Test various error scenarios:**

- [ ] **Network Error:**
  - [ ] Stop middleware service
  - [ ] Try to upload content
  - [ ] **Expected:** Error toast with clear message
  - [ ] **Expected:** UI doesn't break
  - [ ] Restart middleware
  - [ ] Retry operation
  - [ ] **Expected:** Works after reconnect

- [ ] **Invalid Token:**
  - [ ] Manually delete token from localStorage
  - [ ] Try to access dashboard
  - [ ] **Expected:** Redirect to login
  - [ ] **Expected:** No console errors

- [ ] **Session Expiration:**
  - [ ] Wait for token to expire (7 days, not practical)
  - [ ] OR manually set old token
  - [ ] Try any API call
  - [ ] **Expected:** Auto-logout
  - [ ] **Expected:** Redirect to login

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 17. Performance & Load
- [ ] **Upload 10 content items** in quick succession
  - [ ] **Expected:** All succeed
  - [ ] **Expected:** No rate limiting errors (unless by design)
  - [ ] **Expected:** UI stays responsive

- [ ] **Create large playlist** (50+ items)
  - [ ] **Expected:** Can add all items
  - [ ] **Expected:** Pagination works
  - [ ] **Expected:** UI doesn't freeze

- [ ] **Multiple displays** (if possible)
  - [ ] Pair 2-3 displays
  - [ ] Push same content to all
  - [ ] **Expected:** All receive updates
  - [ ] **Expected:** All display content

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

### 18. UI/UX Polish
- [ ] **Loading States:**
  - [ ] Verify spinners show during uploads
  - [ ] Verify skeleton loaders where appropriate
  - [ ] Verify no "flash of empty content"

- [ ] **Error Messages:**
  - [ ] All errors show user-friendly messages
  - [ ] No raw error objects in toasts
  - [ ] No "undefined" or "null" shown to user

- [ ] **Form Validation:**
  - [ ] All required fields marked
  - [ ] Validation messages clear
  - [ ] Validation happens before submit (client-side)
  - [ ] Server validation also works (try bypassing client)

- [ ] **Navigation:**
  - [ ] Back button works correctly
  - [ ] Breadcrumbs work (if present)
  - [ ] Page refresh doesn't break state
  - [ ] Deep links work (e.g., /content/:id)

**Result:**
- Status: [ ] ✅ PASS | [ ] ❌ FAIL
- Bugs found: _______
- Notes: _______

---

## 📊 Summary

**Total Tests:** 18 sections, ~150 individual checks  
**Tests Passed:** ___ / ___  
**Tests Failed:** ___ / ___  
**Critical Bugs:** ___  
**Major Bugs:** ___  
**Minor Bugs:** ___  

---

## 🐛 All Bugs Found

*Will be compiled here from all sections*

1. ______
2. ______
3. ______

---

## ✅ Ready for Production?

**Criteria:**
- [ ] All critical workflows work end-to-end
- [ ] Content push to display works reliably
- [ ] No console errors in normal operation
- [ ] All CRUD operations work
- [ ] Multi-tenant isolation verified
- [ ] Security tests pass
- [ ] Error handling works
- [ ] UI polish acceptable

**Decision:** [ ] ✅ YES, production ready | [ ] ❌ NO, more work needed

**If NO, what needs to be fixed:**
1. ______
2. ______
3. ______

**Estimated time to fix:** ___ hours/days

---

**Testing completed:** _______  
**Tester signature:** _______  
**Approved by:** _______
