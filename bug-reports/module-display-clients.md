# Module Bug Report: Display Clients (Electron + Android TV)

## Module Description
Two display client applications that run on digital signage screens:
- **Electron Desktop** (`display/`): Windows/macOS/Linux desktop app using Webpack + TypeScript
- **Android TV** (`display-android/`): Capacitor 6 + Vite app for Android TV devices with leanback support

---

## Electron Display Client (`display/`)

### Test Execution Summary
**Total Test Suites:** ~4 spec files found (not executed independently)
**Test Coverage:** PARTIAL - some spec files exist but not verified passing

### Key Files
- `src/electron/main.ts` - Electron main process (window management, lifecycle)
- `src/electron/preload.ts` - IPC bridge between renderer and main
- `src/electron/device-client.ts` - WebSocket client for device connection
- `src/electron/cache-manager.ts` - Local cache for offline playback
- `src/app/app.element.ts` - Main application element
- `src/renderer/app.ts` - Renderer process

### Existing Test Files
- `src/electron/main.spec.ts` - Main process tests
- `src/electron/preload.spec.ts` - Preload bridge tests
- `src/electron/device-client.spec.ts` - WebSocket client tests
- `src/electron/cache-manager.spec.ts` - Cache manager tests
- `src/app/app.element.spec.ts` - App element tests
- `src/e2e-tests/display-app.spec.ts` - Playwright E2E tests

### Bugs Found

#### BUG-DISP-001: Display Client Tests Not Verified (Severity: HIGH)
- **Description:** The Electron display client has spec files but they were not executed as part of this test pass. The test runner configuration and pass/fail status is unverified.
- **Impact:** The display client is the end-user facing product that runs on physical signage screens. Test status is unknown.
- **Suggested Fix:** Execute display client tests independently and verify all pass; add to CI pipeline

---

## Android TV Display Client (`display-android/`)

### Test Execution Summary
**Total Test Suites:** 0
**Total Tests:** 0
**Test Coverage:** NONE

### Key Files
- `src/main.ts`: Main entry point with Capacitor + Vite
- `capacitor.config.ts`: Capacitor configuration
- Android native code under `android/`

### Bugs Found

#### BUG-DISP-002: Zero Test Coverage for Android TV Client (Severity: HIGH)
- **Description:** The Android TV display client has no tests
- **Impact:** Same as Electron - the client that runs on physical displays is completely untested
- **Additional Risk:** Android TV has platform-specific concerns:
  - D-pad navigation
  - Leanback launcher integration
  - Auto-start on boot
  - Power management / screen wake
  - Memory constraints on TV devices
- **Suggested Fix:** Add Vitest tests for core application logic; consider Capacitor testing utilities for platform integration

---

## Overall Module Health Rating: **D (Minimal/Unverified Coverage)**

The Electron client has spec files but they were not executed in this pass. The Android TV client has zero test coverage. These are the end-user-facing applications that run on physical signage screens in production. While the backend services (middleware, realtime) that they communicate with are well-tested, the client-side logic for content rendering, WebSocket communication, offline handling, and platform integration is completely unverified through automated testing.

**Recommendation:** For production deployment, manual QA testing of display clients on target hardware is essential until automated tests are added. At minimum, test:
1. Device pairing flow
2. Content display and playlist cycling
3. WebSocket reconnection after network loss
4. Offline content playback
5. Screenshot capture and upload
