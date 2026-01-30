# Manual UI Testing Checklist - Device Pairing Flow

Complete checklist for manually testing the device pairing flow through the web UI.

## Pre-Test Setup

### Prerequisites
- [ ] Middleware API running on `http://localhost:3000`
- [ ] Web app running on `http://localhost:3001`
- [ ] Database is accessible
- [ ] Test account exists: `bro@triveni.com`
- [ ] Browser console available (DevTools open)
- [ ] Test device or test endpoint ready to generate pairing code

### Browser Preparation
- [ ] Open Chrome/Firefox/Safari
- [ ] Open DevTools (F12 or Cmd+Option+I)
- [ ] Go to Console tab
- [ ] Clear any previous data: `localStorage.clear()`
- [ ] Navigate to: `http://localhost:3001`

---

## Test Flow Execution

### Phase 1: Login

#### Login Page
- [ ] Page loads properly (no JS errors in console)
- [ ] Email field is visible
- [ ] Password field is visible
- [ ] "Sign In" button is visible
- [ ] "Create Account" link is visible (optional)

#### Enter Credentials
- [ ] Enter email: `bro@triveni.com`
- [ ] Enter password: `Srini78$$`
- [ ] Password field displays dots (security)

#### Click Sign In
- [ ] Click "Sign In" button
- [ ] Page shows loading state
- [ ] No console errors
- [ ] Redirects to dashboard

#### Dashboard Access
- [ ] Dashboard page loads
- [ ] Left sidebar shows menu items
- [ ] "Devices" link is visible in sidebar
- [ ] User name appears in header (optional)
- [ ] Token appears in localStorage: `localStorage.getItem('authToken')`

---

### Phase 2: Generate Pairing Code

#### Generate Code (API Call)
Execute in console to get a pairing code:
```javascript
const response = await fetch('http://localhost:3000/api/devices/pairing/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceIdentifier: 'test-display-' + Date.now(),
    nickname: 'Test Display Unit',
    metadata: { hostname: 'test-machine', os: 'Windows' }
  })
});
const data = await response.json();
console.log('Pairing Code:', data.code);
console.log('Pairing URL:', data.pairingUrl);
localStorage.setItem('pairingCode', data.code);
localStorage.setItem('pairingUrl', data.pairingUrl);
```

#### Check Code Generated
- [ ] Response shows 6-character code (e.g., ABC123)
- [ ] Code contains only uppercase letters and numbers
- [ ] Code stored in localStorage
- [ ] Pairing URL generated correctly
- [ ] QR code data is present (base64 string)

---

### Phase 3: Navigate to Pairing Page

#### Using Direct URL
- [ ] Get code from console: `localStorage.getItem('pairingCode')`
- [ ] Get URL from console: `localStorage.getItem('pairingUrl')`
- [ ] Navigate to: `http://localhost:3001/dashboard/devices/pair?code=ABC123`
  (replace ABC123 with your code)

#### Page Loads
- [ ] Pairing page loads (no blank screen)
- [ ] No console errors
- [ ] Page title shows "Pair New Device" or similar
- [ ] Pairing code field is auto-populated
- [ ] Code shown in uppercase

#### Via Dashboard Menu
- [ ] Click "Devices" in left sidebar
- [ ] Devices page loads
- [ ] Click "Pair New Device" button
- [ ] Pairing form page appears
- [ ] Code field is empty (no URL param)

---

### Phase 4: Form Fields

#### Pairing Code Field
- [ ] Code field shows auto-filled value: `ABC123`
- [ ] Field displays in large font
- [ ] Code is right-aligned and centered
- [ ] Field has wide letter spacing
- [ ] Field is read-only or shows 6 characters

#### Manual Code Entry
- [ ] Clear auto-filled code
- [ ] Manually type: `abc123` (lowercase)
- [ ] Code auto-converts to uppercase: `ABC123`
- [ ] Only accepts alphanumeric input
- [ ] Rejects special characters
- [ ] Limits to 6 characters max
- [ ] Removes spaces if pasted

#### Device Name Field
- [ ] Label shows "Device Name *"
- [ ] Placeholder shows example (e.g., "Lobby Display")
- [ ] Field accepts text input
- [ ] Field accepts special characters
- [ ] No character limit (or high limit)
- [ ] Required field indicator (asterisk)

#### Location Field (Optional)
- [ ] Label shows "Location (Optional)"
- [ ] Field is optional (no asterisk)
- [ ] Placeholder shows example (e.g., "Main Entrance")
- [ ] Field accepts text input
- [ ] Field is not focused by default

---

### Phase 5: Form Validation

#### Test Invalid Code
- [ ] Clear code field
- [ ] Type: `ABC` (3 characters)
- [ ] "Pair Device" button is disabled
- [ ] Error message shows (or tooltip)
- [ ] Cannot submit form

#### Test Empty Device Name
- [ ] Enter valid code: `ABC123`
- [ ] Leave device name empty
- [ ] "Pair Device" button is disabled
- [ ] Focus on name field shows requirement
- [ ] Cannot submit form

#### Test Valid Form
- [ ] Enter code: `ABC123`
- [ ] Enter name: `Test Display Unit`
- [ ] Leave location empty (optional)
- [ ] "Pair Device" button is enabled
- [ ] Can submit form

#### Test Form Reset
- [ ] Fill all fields
- [ ] Click "Cancel" button
- [ ] Returns to devices list or dashboard
- [ ] Form data is cleared
- [ ] No data persists

---

### Phase 6: Submit Pairing

#### Pre-Submit Checks
- [ ] Code field: `ABC123`
- [ ] Device name: `Test Display Unit`
- [ ] Location field: empty (optional)
- [ ] Button shows "Pair Device"
- [ ] Button is enabled

#### Click "Pair Device"
- [ ] Button shows loading state (spinner)
- [ ] Button becomes disabled
- [ ] No navigation yet
- [ ] Console shows request being made
- [ ] Network tab shows POST to `/complete`

#### Request Details (Network Tab)
- [ ] Method: POST
- [ ] URL: `.../api/devices/pairing/complete`
- [ ] Headers include: `Content-Type: application/json`
- [ ] Headers include: `Authorization: Bearer <token>`
- [ ] Request body includes: `code`, `nickname`
- [ ] Response status: 200 OK

#### Success Response
- [ ] Response includes: `success: true`
- [ ] Response includes display ID
- [ ] Response includes device status
- [ ] No error message shown
- [ ] Console shows success message

#### Toast/Alert Message
- [ ] Success notification appears
- [ ] Message: "paired successfully" (or similar)
- [ ] Toast auto-dismisses after 2-3 seconds
- [ ] Green/success styling
- [ ] Shows device name in message

---

### Phase 7: Post-Pairing Navigation

#### Auto-Redirect
- [ ] After 1-2 seconds, redirects to devices page
- [ ] URL changes to: `.../dashboard/devices`
- [ ] Devices list page loads
- [ ] No console errors

#### Page Status
- [ ] Devices page shows list
- [ ] New device appears in list
- [ ] Device shows correct name: `Test Display Unit`
- [ ] Device shows status: `online` or `paired`
- [ ] Device has ID assigned

#### Device Details
- [ ] Click on paired device (if clickable)
- [ ] Device details page loads (or modal)
- [ ] Shows device name, ID, status
- [ ] Shows when it was paired
- [ ] Shows device location (if set)
- [ ] Action buttons visible (edit, delete)

---

### Phase 8: Error Scenarios

#### Test Expired Code
- [ ] Generate a code
- [ ] Wait 5+ minutes
- [ ] Try to pair with expired code
- [ ] Error message: "Pairing code has expired"
- [ ] Cannot complete pairing
- [ ] Form remains open for retry
- [ ] Can generate new code

#### Test Invalid Code
- [ ] Enter non-existent code: `XXXXXX`
- [ ] Click "Pair Device"
- [ ] Error message: "Pairing code not found"
- [ ] Cannot complete pairing
- [ ] Form remains open
- [ ] User can retry with correct code

#### Test Duplicate Pairing
- [ ] Pair a device successfully
- [ ] Get device identifier from database/API
- [ ] Request new pairing code with same device ID
- [ ] Error: "Device is already paired"
- [ ] Cannot generate new code

#### Test Missing Token
- [ ] Clear token: `localStorage.removeItem('authToken')`
- [ ] Try to pair
- [ ] Error: "Unauthorized" or redirect to login
- [ ] Cannot pair without authentication
- [ ] Redirects to login page

---

### Phase 9: Device Appearance

#### Device in List
- [ ] Device appears in devices list
- [ ] Device name is displayed correctly
- [ ] Device ID is shown (if list shows it)
- [ ] Device status is visible
- [ ] Device has action buttons (edit, delete)
- [ ] Device can be selected/clicked

#### Device Properties
- [ ] Device name: `Test Display Unit`
- [ ] Device status: `online`
- [ ] Created/paired date shown
- [ ] Last heartbeat time shown (if available)
- [ ] Device location shown (if set)

#### Device Functionality
- [ ] Can click device to view details
- [ ] Can rename device
- [ ] Can update location
- [ ] Can assign playlist
- [ ] Can delete/unpair device
- [ ] Can refresh device status

---

### Phase 10: QR Code Functionality

#### QR Code Display
- [ ] When code field has 6 characters, QR appears
- [ ] QR code is visible and properly sized
- [ ] QR code has border/frame
- [ ] QR code is scannable (test with phone)
- [ ] QR disappears if code is cleared

#### QR Code Content
- [ ] Scan QR code with phone camera
- [ ] Phone shows link: `http://localhost:3001/dashboard/devices/pair?code=ABC123`
- [ ] Link opens pairing page in browser
- [ ] Code is auto-filled on mobile

#### Mobile Flow
- [ ] Open QR link on mobile
- [ ] Pairing page loads on mobile
- [ ] Code is auto-filled
- [ ] Form is responsive on mobile
- [ ] Can submit on mobile
- [ ] Success notification appears

---

### Phase 11: Help & Information

#### Instruction Section
- [ ] Shows step-by-step instructions
- [ ] Instructions are clear and concise
- [ ] Instructions match actual flow
- [ ] Shows expected pairing code format

#### Help Section
- [ ] Troubleshooting tips are visible
- [ ] Tips mention:
  - [ ] App must be installed and running
  - [ ] Device must be connected to internet
  - [ ] Codes expire after 5 minutes
  - [ ] Codes are case-insensitive
  - [ ] How to contact support

#### Visual Guide
- [ ] Shows what happens on device
- [ ] Shows what user should do
- [ ] Shows successful pairing result
- [ ] Icons/images are clear

---

### Phase 12: Error Handling

#### Network Error
- [ ] Disconnect internet (or throttle network)
- [ ] Try to submit pairing
- [ ] Error message shows: "Failed to connect"
- [ ] Form remains open
- [ ] Can retry after network restored

#### Timeout Error
- [ ] With slow network, submit pairing
- [ ] If takes > 30s, timeout error shows
- [ ] Message: "Request timeout"
- [ ] Form remains open
- [ ] User can retry

#### Server Error
- [ ] If server returns 500 error
- [ ] Error message shown to user
- [ ] Message is helpful (not technical)
- [ ] Form remains open for retry

#### Validation Error
- [ ] Try submitting with invalid data
- [ ] Specific field errors shown
- [ ] Message explains what's wrong
- [ ] Focus moves to invalid field
- [ ] User can fix and retry

---

### Phase 13: Data Persistence

#### Form Data Persistence
- [ ] If page refreshes, code persists (if from URL)
- [ ] Device name does NOT persist after refresh
- [ ] Location does NOT persist after refresh
- [ ] Form is reset on new page load

#### Database Persistence
- [ ] Paired device shows after page refresh
- [ ] Device data persists across sessions
- [ ] Device status updates (heartbeat)
- [ ] Paired timestamp remains constant

#### Session Persistence
- [ ] Logout and login again
- [ ] Paired device still visible
- [ ] Device data unchanged
- [ ] Can unpair and re-pair device

---

### Phase 14: Cross-Device Testing

#### Same Browser, Different Tabs
- [ ] Open pairing in Tab 1
- [ ] Open devices list in Tab 2
- [ ] Complete pairing in Tab 1
- [ ] Tab 2 still shows old list (no real-time)
- [ ] Refresh Tab 2 shows new device

#### Different Browsers
- [ ] Pair device in Chrome
- [ ] Open Firefox
- [ ] Login and check devices
- [ ] Device visible in Firefox
- [ ] Device data is same

#### Different Machines
- [ ] Pair device on Machine A
- [ ] Open dashboard on Machine B
- [ ] Login same account
- [ ] Device visible on Machine B
- [ ] Can manage device from any machine

---

### Phase 15: Performance

#### Page Load Time
- [ ] Pairing page loads in < 2 seconds
- [ ] Devices list loads in < 2 seconds
- [ ] No noticeable delay or lag

#### Form Response
- [ ] Typing in code field is responsive
- [ ] No lag when entering device name
- [ ] Buttons respond immediately to clicks

#### API Response
- [ ] Pairing request takes < 500ms
- [ ] Status check is instant
- [ ] Device list updates quickly

---

### Phase 16: Accessibility

#### Keyboard Navigation
- [ ] Tab through form fields
- [ ] Code field can be focused
- [ ] Name field can be focused
- [ ] Location field can be focused
- [ ] Buttons can be focused with Tab
- [ ] Buttons can be activated with Enter
- [ ] Can use Tab+Shift to go backwards

#### Screen Reader
- [ ] Form labels are accessible
- [ ] Required fields marked (aria-required)
- [ ] Error messages announced
- [ ] Success messages announced
- [ ] Buttons have clear labels
- [ ] Status updates announced

#### Color Contrast
- [ ] Code field has good contrast
- [ ] Labels are readable
- [ ] Error messages are readable
- [ ] Buttons have good contrast
- [ ] Success messages readable

#### Mobile Accessibility
- [ ] Form is finger-friendly (large touches)
- [ ] Buttons are large enough to tap
- [ ] Text is readable without zoom
- [ ] Form can be used portrait and landscape

---

## Bug Report Template

If you find issues, document them using this template:

```markdown
### Bug: [Brief Title]

**Severity**: [Critical/High/Medium/Low]

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [Steps to trigger bug]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happens]

**Console Errors**:
[Any JavaScript errors]

**Network Errors**:
[Any HTTP errors]

**Environment**:
- Browser: [Chrome/Firefox/Safari/Edge]
- OS: [Windows/macOS/Linux]
- Middleware URL: [localhost:3000]
- Web URL: [localhost:3001]

**Screenshots**:
[Attach if applicable]

**Additional Notes**:
[Any other relevant info]
```

---

## Test Completion Checklist

### All Tests Completed
- [ ] Phase 1: Login ✓
- [ ] Phase 2: Code Generation ✓
- [ ] Phase 3: Navigation ✓
- [ ] Phase 4: Form Fields ✓
- [ ] Phase 5: Validation ✓
- [ ] Phase 6: Submission ✓
- [ ] Phase 7: Post-Pairing ✓
- [ ] Phase 8: Error Scenarios ✓
- [ ] Phase 9: Device Appearance ✓
- [ ] Phase 10: QR Code ✓
- [ ] Phase 11: Help Info ✓
- [ ] Phase 12: Error Handling ✓
- [ ] Phase 13: Persistence ✓
- [ ] Phase 14: Cross-Device ✓
- [ ] Phase 15: Performance ✓
- [ ] Phase 16: Accessibility ✓

### Issues Found
- [ ] No issues found - Ready for release
- [ ] [X] issues found - See bug reports below

### Sign-Off
- **Tester**: [Name]
- **Date**: [Date]
- **Browser**: [Browser/Version]
- **OS**: [Operating System]
- **Status**: [✓ Pass / ✗ Fail / △ Partial]

---

## Quick Test (5 Minutes)

If pressed for time, run this quick test:

1. [ ] Login successfully
2. [ ] Navigate to pairing page
3. [ ] Enter pairing code
4. [ ] Enter device name
5. [ ] Click "Pair Device"
6. [ ] Success message appears
7. [ ] Device shows in devices list
8. [ ] Device status is online

---

## Extended Test (30 Minutes)

For thorough testing, include:

1. [ ] All 16 phases above
2. [ ] Test on multiple browsers
3. [ ] Test mobile responsive
4. [ ] Test error scenarios
5. [ ] Check network requests
6. [ ] Verify database records
7. [ ] Test QR code scanning
8. [ ] Cross-browser compatibility

---

## Notes

- Keep DevTools open to catch console errors
- Check Network tab for API responses
- Verify database for new device records
- Test on multiple browsers if possible
- Check mobile responsive design
- Document any issues found

---

**Last Updated**: 2026-01-29
**Test Version**: 1.0
**Status**: Ready for Testing

For automated testing, use: `node test-pairing-flow.js`
