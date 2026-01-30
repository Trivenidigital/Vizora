# Manual Web UI Pairing Test Guide
**Status:** Ready to Test
**Pairing Code:** M3KGX6 (from recent test)
**Expiration:** 5 minutes

---

## Quick Start - Test the Web UI

### Option 1: Use Auto-Fill Link (Recommended)

1. **Open this URL directly in your browser:**
   ```
   http://localhost:3001/dashboard/devices/pair?code=M3KGX6
   ```

2. **You should see:**
   - Login page (if not authenticated)
   - "Pair New Device" heading
   - Pairing code field **already filled with: M3KGX6**
   - Device name field (empty)

3. **Complete the form:**
   - Device Name: `Test Display Unit` (or your preferred name)
   - Location: `Test Lab` (optional)

4. **Click "Pair Device" button**

5. **Expected Result:**
   - ✅ Green success message
   - ✅ Redirect to devices list
   - ✅ New device appears in list

---

### Option 2: Manual Code Entry

1. **Open Web Dashboard:**
   ```
   http://localhost:3001
   ```

2. **Login with:**
   - Email: `bro@triveni.com`
   - Password: `Srini78$$`

3. **Navigate to:** Dashboard → Devices → Pair New Device

4. **Enter Pairing Code Manually:**
   - Code: `M3KGX6` (uppercase only)
   - Device Name: `Test Display Unit`

5. **Submit and verify success**

---

## Step-by-Step Screenshots Description

### Screen 1: Pairing Form (Before)
```
┌─────────────────────────────────────────┐
│     Pair New Device                     │
│                                         │
│  How to Pair Your Device:               │
│  1. Open the Vizora Display App         │
│  2. A 6-character code will show        │
│  3. Enter that code below               │
│  4. Click "Pair Device"                 │
│                                         │
│  [Pairing Code*]                        │
│  [M3KGX6                    ]  (filled) │
│                                         │
│  [Device Name*]                         │
│  [Test Display Unit         ]           │
│                                         │
│  [Location (Optional)]                  │
│  [Test Lab                  ]           │
│                                         │
│  [Cancel]  [Pair Device]                │
└─────────────────────────────────────────┘
```

### Screen 2: QR Code (When Code is 6 chars)
```
┌─────────────────────────────────────────┐
│  Code automatically shows QR:           │
│                                         │
│  QR Code for Mobile                     │
│  Scan to autofill code on mobile        │
│                                         │
│  ┌─────────────────┐                    │
│  │ ███ ██ ███ ██ █ │                    │
│  │ █   █  ██ █ ██  │  (QR Code)        │
│  │ █ █ ██ ██ ███ █ │                    │
│  │     █ █ █████   │                    │
│  │ ██ ███ █ █  ███ │                    │
│  └─────────────────┘                    │
└─────────────────────────────────────────┘
```

### Screen 3: Success Message (After Pairing)
```
┌─────────────────────────────────────────┐
│  ✅ Device "Test Display Unit"          │
│     paired successfully!                │
│                                         │
│  Redirecting to devices...              │
└─────────────────────────────────────────┘
```

---

## Form Validation Rules

| Field | Rules | Example |
|-------|-------|---------|
| **Pairing Code** | Exactly 6 characters, alphanumeric | `M3KGX6` |
| **Device Name** | Required, any text | `Test Display Unit` |
| **Location** | Optional | `Test Lab` |

**Validation Behavior:**
- ✅ Codes auto-converted to uppercase
- ✅ Non-alphanumeric characters removed
- ✅ Button disabled until both required fields filled
- ✅ Real-time validation feedback

---

## Expected Behaviors

### ✅ Success Path
```
1. Open pairing link with valid code
   ↓
2. Code auto-fills (or user enters manually)
   ↓
3. Enter device name
   ↓
4. Click "Pair Device"
   ↓
5. Success message appears
   ↓
6. Redirect to devices page (1.5 seconds)
```

### ❌ Error Path Examples

**Invalid Code (not 6 chars):**
```
User enters: "ABC12" (5 chars)
Button: DISABLED
Error message: "Please enter a valid 6-character pairing code"
```

**Code Already Used:**
```
User enters: "ABC123" (already paired)
Button: Click enabled
Result: Error - "Pairing code not found or expired"
Toast: "Failed to pair device..."
```

**No Device Name:**
```
User leaves device name blank
Button: DISABLED
Help text: "Please enter a device name"
```

---

## Testing Checklist

- [ ] **Login Test**
  - [ ] Navigate to http://localhost:3001
  - [ ] Enter credentials: bro@triveni.com / Srini78$$
  - [ ] Login successful

- [ ] **URL Auto-Fill Test**
  - [ ] Open: http://localhost:3001/dashboard/devices/pair?code=M3KGX6
  - [ ] Code appears auto-filled: M3KGX6
  - [ ] Success toast: "Code autofilled from QR scan!"

- [ ] **QR Display Test**
  - [ ] Code field has 6 characters
  - [ ] QR code section appears
  - [ ] QR code is visible and scannable

- [ ] **Form Validation Test**
  - [ ] Try submitting with empty code - disabled
  - [ ] Try submitting with empty device name - disabled
  - [ ] Try submitting with 5-char code - disabled
  - [ ] Try submitting with 7-char code - trimmed to 6

- [ ] **Successful Pairing Test**
  - [ ] Fill code: M3KGX6
  - [ ] Fill name: Test Display Unit
  - [ ] Click "Pair Device"
  - [ ] Success message appears
  - [ ] Redirects to devices page

- [ ] **Device List Test**
  - [ ] After redirect, new device appears in list
  - [ ] Device name: "Test Display Unit"
  - [ ] Device status shows
  - [ ] Device ID visible

- [ ] **Error Handling Test**
  - [ ] Try pairing with invalid code
  - [ ] Error message appears
  - [ ] Toast notification shown
  - [ ] User stays on form (not redirected)

---

## Keyboard Shortcuts

- **Tab:** Navigate between fields
- **Enter:** Submit form (when enabled)
- **Escape:** Clear field (some browsers)

---

## Troubleshooting During Web UI Test

### Code Auto-Fill Not Working
```
Cause:    URL parameter not passed
Solution: Make sure URL includes ?code=M3KGX6
          Check the full URL in address bar
```

### QR Code Not Showing
```
Cause:    Code is not 6 characters
Solution: Complete typing the full 6-character code
          Or paste it from the QR code generation
```

### Form Submits But Shows Error
```
Cause:    Code might be expired (5 minute window)
Solution: Generate a new pairing code on the device
          And use the new code
```

### Redirect Not Working
```
Cause:    JavaScript disabled or UI issue
Solution: Manually navigate to /dashboard/devices
          Check browser console for errors
```

---

## What Gets Stored After Pairing

After successful pairing, the system records:

```json
{
  "displayId": "f51a9e17-aa78-4be3-8bef-47f12a915bb9",
  "deviceIdentifier": "test-display-001",
  "nickname": "Test Display Unit",
  "organizationId": "4cf8a0c6-cb2e-4842-85db-fbfe53d5e13c",
  "status": "online",
  "pairedAt": "2026-01-30T03:15:25.000Z",
  "deviceJWTToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Integration with Electron Display

After web pairing completes:

1. **Device polls status endpoint:**
   ```
   GET /api/devices/pairing/status/M3KGX6
   Response: { status: "paired", deviceToken: "..." }
   ```

2. **Device receives JWT token:**
   ```
   Token valid for: 1 year
   Scope: Device communication only
   ```

3. **Device connects to realtime:**
   ```
   WebSocket: ws://localhost:3002
   Authentication: JWT token
   Events: playlist:update, command, heartbeat
   ```

4. **Display transitions to:**
   ```
   Pairing Screen → Content Display Screen
   ```

---

## Next Testing Steps

### After Web UI Success ✅

**Test Electron Display Client:**
```bash
cd C:\Projects\vizora\vizora\display
npm start
```

Expected behavior:
1. Window opens
2. Shows pairing screen
3. Displays 6-digit code
4. Shows QR code image
5. Polls for pairing status
6. After web pairing → detects "paired" status
7. Connects to realtime server
8. Transitions to content screen

---

## Success Criteria

✅ **Web UI Test Passed When:**

- Code auto-fills from URL parameter
- Form validates inputs correctly
- Device can be paired with code + name
- Success message appears
- Device appears in devices list
- No console errors in browser
- Redirect works properly

---

**Ready to Test? Open this link:**
```
http://localhost:3001/dashboard/devices/pair?code=M3KGX6
```

