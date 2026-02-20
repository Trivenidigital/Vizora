# Vizora Android TV Display Client — Quality Audit & Production Readiness Assessment

**Date:** 2026-02-20
**Auditor:** Claude Code (Automated + Emulator Testing)
**Branch:** `feat/template-admin-crud`
**App Version:** 1.0.0 (versionCode 1)

---

## A: Executive Summary

### Overall Production Readiness: **NOT READY**

The Vizora Android TV Display Client is a well-structured Capacitor 6 hybrid app with solid core functionality — pairing, WebSocket communication, playlist playback, content caching, and multi-zone layouts are all implemented. However, **several critical and high-severity issues** block production deployment.

### Issues by Severity

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 8 |
| MEDIUM | 7 |
| LOW | 6 |
| **Total** | **25** |

### Top 5 Blockers

1. **CRITICAL — Release APK is unsigned** — No keystore configured; cannot distribute via Play Store or sideload securely
2. **CRITICAL — WebView debugging enabled in release build** — `webContentsDebuggingEnabled: true` baked into release APK assets, allowing Chrome DevTools access to production devices
3. **CRITICAL — `clear_cache` command wipes device credentials** — `Preferences.clear()` removes device token and forces re-pairing
4. **CRITICAL — Device token stored in plain SharedPreferences** — Capacitor Preferences uses unencrypted XML on disk; device JWT tokens are accessible via ADB or root
5. **HIGH — No crash recovery/auto-restart mechanism** — If the app crashes, it stays dead until manually relaunched (critical failure mode for 24/7 signage)

---

## B: Build & Configuration

### Build Status

| Check | Status | Notes |
|-------|--------|-------|
| Vite web build | PASS | 677ms, 122KB total JS output |
| Gradle debug build | PASS | 1m 19s, 3.7MB APK |
| Gradle release build | PASS | 57s, 1.1MB APK |
| Android Lint | PASS (warnings only) | 14 warnings, 0 errors |
| Release signing | **FAIL** | No keystore.properties — APK is unsigned |
| ProGuard/R8 | PASS | `minifyEnabled true`, `shrinkResources true` in release |

### SDK Versions

| Parameter | Value | Assessment |
|-----------|-------|------------|
| minSdkVersion | 22 (Android 5.1) | Acceptable but old. Consider 24+ for network security config support |
| compileSdkVersion | 34 (Android 14) | Good |
| targetSdkVersion | 34 (Android 14) | Good |
| AGP | 8.2.1 | Current |
| Gradle | 8.2.1 | Current |
| JDK | 21 (Android Studio bundled JBR) | Current |
| Capacitor | 6.2.1 | Current major version |

### Signing Configuration

The `app/build.gradle` has a well-structured signing config that reads from `keystore.properties`, but **the file does not exist**. The release build produces an **unsigned APK** that cannot be installed on production devices or submitted to any store.

### ProGuard/R8

R8 is enabled for release builds with default rules plus `proguard-android-optimize.txt`. The custom `proguard-rules.pro` file is **empty** (all rules commented out). Since this is a WebView-based Capacitor app, the default rules are likely sufficient, but the WebView JavaScript interface rules should be uncommented for safety:
```
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}
```

### Lint Warnings (14 total)

- 2x `UnusedAttribute` — `usesCleartextTraffic` and `networkSecurityConfig` require API 23/24 (min is 22)
- 1x `ManifestOrder` — `<uses-permission>` after `<application>` tag
- 7x `UnusedResources` — Dead resources: `activity_main.xml`, `config.xml`, drawables, strings, styles
- 2x `MonochromeLauncherIcon` — Missing monochrome adaptive icon tag
- 2x `IconDipSize`/`IconLocation` — Splash image inconsistencies across densities

---

## C: Code Quality Findings

### C1: CRITICAL — WebView Debugging Enabled in Release Build

- **Severity:** CRITICAL
- **Category:** Security
- **File:** `display-android/capacitor.config.ts:35` and compiled `android/app/src/main/assets/capacitor.config.json:31`
- **Problem:** `capacitor.config.ts` uses `const isDev = process.env.NODE_ENV !== 'production'`. When `cap sync` runs (triggered by `npm run android:build` which calls `cap sync android`), `NODE_ENV` is not set to `production`, so `isDev` evaluates to `true`. The compiled `capacitor.config.json` embedded in the APK has:
  ```json
  "webContentsDebuggingEnabled": true,
  "allowMixedContent": true
  ```
- **Impact:** Anyone with USB access to a production display can attach Chrome DevTools, inspect the WebView, read device tokens, call internal APIs, and inject code. `allowMixedContent: true` bypasses mixed-content protections.
- **Fix:** Either (a) set `NODE_ENV=production` during build, or (b) remove the dynamic logic and hardcode `webContentsDebuggingEnabled: false` and `allowMixedContent: false` with a separate dev override.

### C2: CRITICAL — Device Token Stored in Plain SharedPreferences

- **Severity:** CRITICAL
- **Category:** Security
- **File:** `src/main.ts:403-404`
- **Problem:** Device JWT token is stored via `Preferences.set({ key: 'device_token', value: data.deviceToken })`. Capacitor's `@capacitor/preferences` uses Android's `SharedPreferences`, which stores data as **unencrypted XML** in `/data/data/com.vizora.display/shared_prefs/`.
- **Impact:** On rooted devices (common in signage deployments), the device JWT can be extracted and used to impersonate the display. Even without root, on older Android versions (< 7), other apps with backup access could extract it.
- **Fix:** Use Android's `EncryptedSharedPreferences` via a custom Capacitor plugin, or store the token in the Android Keystore.

### C3: CRITICAL — `clear_cache` Command Wipes Device Credentials

- **Severity:** CRITICAL
- **Category:** Architecture / Logic Bug
- **File:** `src/main.ts:805-809`
- **Problem:** The `clear_cache` command handler calls `Preferences.clear()` which removes ALL preferences, including `device_token` and `device_id`. After reload, the device enters pairing mode.
- **Impact:** A well-intentioned `clear_cache` command from the admin dashboard unpairs the device, requiring physical access to re-pair it. In a deployment with 100+ displays, this could be catastrophic.
- **Fix:** Replace `Preferences.clear()` with selective clearing — remove only cached content-related keys, not credentials or config.

### C4: CRITICAL — Release APK Is Unsigned

- **Severity:** CRITICAL
- **Category:** Configuration
- **File:** `android/app/build.gradle:28-37`, missing `android/keystore.properties`
- **Problem:** No `keystore.properties` file exists. The release build produces an unsigned APK.
- **Impact:** Cannot distribute via Google Play, cannot sideload on devices with signature verification, cannot perform future updates (Android requires matching signatures).
- **Fix:** Generate a production keystore, create `keystore.properties`, store securely. Document the keystore management process.

### C5: HIGH — No Crash Recovery / Auto-Restart Mechanism

- **Severity:** HIGH
- **Category:** Stability / Resilience
- **File:** N/A (missing feature)
- **Problem:** If the app crashes (uncaught exception in the WebView, native OOM kill), it simply dies. There is no:
  - Global uncaught exception handler
  - Watchdog timer
  - Android Service-based restart mechanism
  - PM2/process manager equivalent
- **Impact:** For a 24/7 signage device, a crash means a blank screen until someone physically restarts the app. The `BootReceiver` only handles device boot, not app crashes.
- **Fix:** Implement an `UncaughtExceptionHandler` in `MainActivity.java` that schedules a restart via `AlarmManager`. Or run the app as a foreground service with `START_STICKY` restart behavior.

### C6: HIGH — No Offline Fallback Content

- **Severity:** HIGH
- **Category:** Resilience
- **File:** `src/main.ts` (missing feature)
- **Problem:** When the device loses network during the pairing screen, it retries every 5 seconds. When already paired but offline:
  - If content was cached, cached content should play (cache manager exists)
  - But there is no "last known playlist" persistence — the playlist is only in memory
  - If the app restarts while offline, it has no playlist to display
- **Impact:** Power outage + network outage = blank screen with no content.
- **Fix:** Persist the current playlist to Preferences on every update. On startup, if offline but paired, load the last known playlist from storage and play cached content.

### C7: HIGH — WebSocket Reconnection Relies on Socket.IO Defaults

- **Severity:** HIGH
- **Category:** Network / Resilience
- **File:** `src/main.ts:505-514`
- **Problem:** Socket.IO config has `reconnectionDelay: 1000` and `reconnectionDelayMax: 5000`. This is a very tight window (max 5s between retries). For prolonged outages, this means the device will hammer the server with reconnection attempts every 1-5 seconds indefinitely.
- **Impact:** Rapid reconnection attempts drain battery/resources on the device and create thundering-herd problems on the server when network is restored to many devices simultaneously.
- **Fix:** Increase `reconnectionDelayMax` to 30000-60000ms. Add jitter. Consider implementing custom exponential backoff with longer intervals for extended outages.

### C8: HIGH — `usesCleartextTraffic="true"` in AndroidManifest

- **Severity:** HIGH
- **Category:** Security
- **File:** `android/app/src/main/AndroidManifest.xml:16`
- **Problem:** The manifest sets `android:usesCleartextTraffic="true"` globally, while also having a `network_security_config.xml` that properly restricts cleartext to localhost only. The manifest attribute **overrides** the security config on API 23-27 and the global attribute wins, allowing cleartext traffic to ANY host.
- **Impact:** API calls, WebSocket connections, and content downloads can be intercepted via MITM attacks on the local network. Production `.env` points to `https://vizora.cloud`, but the OS won't enforce HTTPS-only.
- **Fix:** Remove `android:usesCleartextTraffic="true"` from the manifest. The `network_security_config.xml` already handles the localhost exception for development.

### C9: HIGH — `MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW` in MainActivity

- **Severity:** HIGH
- **Category:** Security
- **File:** `android/app/src/main/java/com/vizora/display/MainActivity.java:13`
- **Problem:** `getMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW)` allows loading HTTP resources from HTTPS pages unconditionally. The comment says "needed for local dev with MinIO" but this is set in all builds.
- **Impact:** Allows insecure resources to be loaded in the WebView, defeating HTTPS protections. An attacker on the local network could inject malicious content.
- **Fix:** Only set this in debug builds: `if (BuildConfig.DEBUG) { ... }`.

### C10: HIGH — BootReceiver Is Exported Without Permission Protection

- **Severity:** HIGH
- **Category:** Security
- **File:** `android/app/src/main/AndroidManifest.xml:40-46`
- **Problem:** `BootReceiver` is declared with `android:exported="true"` but no `android:permission` attribute. While `BOOT_COMPLETED` itself is a system broadcast, any app could potentially send a matching intent to start the app.
- **Impact:** Low practical risk since `BOOT_COMPLETED` filter limits it, but best practice is to add `android:permission="android.permission.RECEIVE_BOOT_COMPLETED"` for defense in depth.
- **Fix:** Add permission attribute to the receiver.

### C11: HIGH — Pairing Code Retry Has No Backoff or Limit

- **Severity:** HIGH
- **Category:** Network / Resilience
- **File:** `src/main.ts:274-276, 324-325`
- **Problem:** When pairing request fails, the retry is a fixed 5-second delay with no limit: `setTimeout(() => this.startPairing(), 5000)`. The pairing status check polls every 2 seconds (line 411). If the server is down, the device will make HTTP requests every 2-5 seconds forever.
- **Impact:** Unnecessary server load and network traffic. If 1000 devices lose connection simultaneously, the server gets 200-500 requests/second from pairing retries alone.
- **Fix:** Implement exponential backoff with jitter (e.g., 5s, 10s, 20s, 40s, max 5min). Add a reasonable retry limit after which the device shows a "server unreachable" message with a manual retry button.

### C12: HIGH — No Content Validation or Sanitization

- **Severity:** HIGH
- **Category:** Security
- **File:** `src/main.ts:697-707` (HTML/template rendering)
- **Problem:** HTML content received via WebSocket is rendered in a sandboxed iframe with `allow-scripts`, but there's no validation of the content. The `srcdoc` value comes directly from the server via `content.url`. While the sandbox blocks some attacks, `allow-scripts` still permits JavaScript execution within the iframe.
- **Impact:** If the server is compromised or a malicious template is uploaded, arbitrary JavaScript runs on the display device. The sandbox prevents escaping to the parent, but the iframe can still make network requests, display phishing content, etc.
- **Fix:** Add CSP headers to the sandboxed iframe. Consider using `allow-scripts allow-same-origin` only when necessary and validating content server-side.

### C13: MEDIUM — Splash Screen Shows Capacitor Default, Not Vizora Branding

- **Severity:** MEDIUM
- **Category:** UI / Branding
- **File:** `android/app/src/main/res/drawable/splash.png`
- **Problem:** The splash screen displays the default Capacitor "X" logo instead of Vizora branding. Observed on emulator during cold start and after force-stop recovery.
- **Impact:** Unprofessional appearance during app launch. For client-facing signage, this is visible to anyone watching the screen during boot.
- **Fix:** Replace `splash.png` in all density folders with Vizora-branded splash image.

### C14: MEDIUM — `any` Types Used Extensively

- **Severity:** MEDIUM
- **Category:** Code Quality
- **Files:** `src/main.ts:105, 473, 799, 839, 999, 1056, 1060, 1091, 1113`
- **Problem:** Multiple `any` types throughout the codebase:
  - `qrOverlayConfig: any = null` (line 105)
  - `response.commands.forEach((cmd: any)` (line 473)
  - `handleCommand(command: { type: string; payload?: Record<string, unknown>; [key: string]: unknown })` (line 799) — better but payload still uses `unknown`
  - `renderQrOverlay(config: any)` (line 999)
  - `renderLayout(content: any)` (line 1056)
  - `createZonePlayer(zoneId: string, playlist: any, container: HTMLElement)` (line 1091)
  - `renderZoneContent(content: any, container: HTMLElement)` (line 1113)
- **Impact:** No type safety for critical data structures. Runtime errors possible with unexpected data shapes.
- **Fix:** Define proper interfaces for QR overlay config, layout metadata, and zone content.

### C15: MEDIUM — Video Elements Not Properly Cleaned Up

- **Severity:** MEDIUM
- **Category:** Memory / Lifecycle
- **File:** `src/main.ts:623, 887`
- **Problem:** When switching between content items, the container is cleared with `container.innerHTML = ''`. This removes video elements from the DOM but doesn't explicitly call `video.pause()` or `video.src = ''` first.
- **Impact:** On some Android WebView versions, removing a playing video element without pausing first can cause the audio to continue playing in the background. Over time, orphaned video resources may cause memory leaks.
- **Fix:** Before clearing the container, find any `<video>` elements, pause them, set `src = ''`, and call `load()` to release the media resource.

### C16: MEDIUM — Cache Manager Manifest Saved on Every Read (Performance)

- **Severity:** MEDIUM
- **Category:** Performance
- **File:** `src/cache-manager.ts:150-151`
- **Problem:** `getCachedUri()` updates `lastAccessed` and calls `saveManifest()` on every cache hit. `saveManifest()` writes the entire manifest JSON to the filesystem.
- **Impact:** During playlist playback, every content item triggers a file write. With a 10-item playlist cycling every 10 seconds, that's 6 file writes per minute — unnecessary I/O that can cause jank, especially on low-end TV hardware.
- **Fix:** Debounce manifest saves (e.g., save at most once every 60 seconds), or only update `lastAccessed` in memory and batch-save periodically.

### C17: MEDIUM — Pairing Poll Interval Never Clears on Pairing Timeout

- **Severity:** MEDIUM
- **Category:** Logic Bug
- **File:** `src/main.ts:374-411`
- **Problem:** The pairing check interval polls every 2 seconds. If the server returns 404 (pairing code expired), it calls `this.startPairing()` which calls `this.startPairingCheck()` which clears and recreates the interval. But if the network goes down during pairing, the interval keeps running with silent catch blocks, never clearing itself.
- **Impact:** Multiple overlapping intervals could accumulate if pairing is retried while an old interval is still running. The `startPairingCheck()` does clear the old interval, so this is mitigated for the normal flow, but edge cases (rapid network flapping) could still cause issues.
- **Fix:** Add a guard to ensure only one pairing check interval exists at any time.

### C18: MEDIUM — `versionCode 1` — Not Increment-Ready

- **Severity:** MEDIUM
- **Category:** Configuration
- **File:** `android/app/build.gradle:11`
- **Problem:** `versionCode 1` is hardcoded. For Play Store updates, versionCode must increment with every release. No CI/CD or versioning strategy is in place.
- **Impact:** Cannot publish updates without manually editing the build file.
- **Fix:** Automate versionCode via build number, git commit count, or CI variable.

### C19: MEDIUM — No Screen Burn-In Prevention

- **Severity:** MEDIUM
- **Category:** TV-Specific
- **File:** N/A (missing feature)
- **Problem:** The pairing screen displays static content (QR code, text, code) that doesn't move. OLED and some LED TVs are susceptible to burn-in from static elements.
- **Impact:** Devices stuck on the pairing screen for extended periods could develop permanent screen artifacts. The status bar overlay (always visible) is also a burn-in risk.
- **Fix:** Add subtle animation/position shifting to the pairing screen. Auto-hide the status bar after a few seconds during content playback (it already has opacity: 0.7, but static position is the issue).

### C20: LOW — `.env` File Contains Production URLs But Is Gitignored

- **Severity:** LOW
- **Category:** Configuration
- **File:** `display-android/.env`
- **Problem:** The `.env` file is gitignored (correct), but the current working copy contains production URLs (`https://vizora.cloud`). The `.env.example` has different placeholder URLs (`https://api.vizora.io`). This inconsistency means new developers must know which URLs to use.
- **Impact:** Minor confusion for new developers. No security risk since the file is gitignored.
- **Fix:** Align `.env.example` with the actual production domain, or document the setup clearly.

### C21: LOW — Debug APK Has Double Suffix in Filename

- **Severity:** LOW
- **Category:** Build Config
- **File:** `android/app/build.gradle:64`
- **Problem:** Debug APK is named `vizora-display-1.0.0-debug-debug.apk`. The `applicationIdSuffix ".debug"` and `versionNameSuffix "-debug"` combine with the output filename template `vizora-display-${versionName}-${buildType}.apk` to produce the double-debug name.
- **Impact:** Cosmetic only. Confusing filename.
- **Fix:** Remove `versionNameSuffix` from the debug build type, since the buildType is already appended.

### C22: LOW — Unused Resources (7 items)

- **Severity:** LOW
- **Category:** Code Quality
- **Files:** Various (see lint report)
- **Problem:** 7 unused Android resources: `activity_main.xml`, `config.xml`, `ic_launcher_background.xml`, `ic_launcher_foreground.xml`, `package_name` string, `custom_url_scheme` string, `AppTheme.NoActionBar` style.
- **Impact:** Slightly larger APK size. No functional impact.
- **Fix:** Remove unused resources.

### C23: LOW — Manifest Element Ordering

- **Severity:** LOW
- **Category:** Code Quality
- **File:** `android/app/src/main/AndroidManifest.xml:60`
- **Problem:** `<uses-permission>` elements appear after `<application>` tag. Should appear before.
- **Impact:** Can cause subtle theme/styling issues on some Android versions.
- **Fix:** Move permission declarations before the `<application>` tag.

### C24: LOW — Missing Monochrome Adaptive Icon

- **Severity:** LOW
- **Category:** UI
- **Files:** `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml`
- **Problem:** Adaptive icons missing `<monochrome>` tag for Android 13+ themed icons.
- **Impact:** App icon won't follow the device's theme on Android 13+. Minor for TV (most TVs don't use themed icons).
- **Fix:** Add monochrome icon variant.

### C25: LOW — Test Coverage Is Minimal

- **Severity:** LOW
- **Category:** Testing
- **File:** `src/cache-manager.spec.ts`
- **Problem:** Only 3 trivial tests exist (instantiation checks). No tests for:
  - Pairing flow logic
  - WebSocket event handling
  - Content rendering
  - Playlist playback
  - Command handling
  - Cache download/eviction
- **Impact:** No regression safety net. Changes can break functionality without detection.
- **Fix:** Add unit tests for the cache manager (already has test stubs) and integration tests for the main class with mocked Capacitor plugins.

---

## D: Emulator Test Results

**Emulator:** Medium Phone API 36.1 (no Android TV AVD available)
**Test APK:** `vizora-display-1.0.0-debug-debug.apk` (3.7MB)

### D1: App Launch & Boot — PASS

- **Cold start:** App launches successfully. Splash screen appears (~2s), transitions to pairing screen.
- **Start time:** ~3-4 seconds to pairing screen (acceptable).
- **Splash screen:** Shows Capacitor default logo, not Vizora branding (see C13).
- **Pairing code:** Displays immediately with QR code and 6-character code.
- **Status bar:** Shows "Waiting for pairing..." in yellow/connecting state.

### D2: Device Pairing Flow — PARTIAL

- **Pairing code displayed:** YES, clearly visible (code: `6HVDUG` on first launch).
- **QR code displayed:** YES, well-formatted and scannable.
- **Polling for confirmation:** YES, every 2 seconds via HTTP GET to `/api/v1/devices/pairing/status/{code}`.
- **API connectivity:** Confirmed via logcat — app successfully communicates with `https://vizora.cloud` backend.
- **CSRF handling:** App correctly receives and stores CSRF cookies.
- **Pairing completion:** NOT TESTED (requires active dashboard session to complete pairing).
- **Pairing timeout:** Code eventually expires (server-side 404), app auto-requests new code — WORKS.
- **Network error during pairing:** App continues showing pairing screen, retries on 5s interval — WORKS.

### D3: Content Display — NOT TESTED

Requires completed pairing to receive content pushes. Cannot test without active backend pairing session.

### D4: Playlist Playback — NOT TESTED

Same as D3 — requires paired state.

### D5: Remote Content Push — NOT TESTED

Same as D3.

### D6: Error & Recovery — PASS (partial)

- **Force-stop and relaunch:** App successfully recovers, generates new pairing code, shows pairing screen. PASS.
- **Back button:** App correctly ignores back button (doesn't exit). PASS.
- **Network disconnection:** When WiFi disabled, phone switched to LTE — app continued working. True offline test (airplane mode) blocked by emulator API restrictions.

### D7: Long-Running Stability — PARTIAL

- **Memory at launch:** ~75MB PSS
- **Memory after ~8 minutes:** ~89MB PSS (+14MB increase)
- **Assessment:** Moderate memory growth during pairing polling phase. 14MB in 8 minutes is concerning if it continues linearly — would reach ~180MB after 1 hour. However, this could stabilize (Dalvik heap growth is often front-loaded). Longer monitoring needed.
- **No crashes observed** during testing period.

### D8: D-pad Navigation — PASS (limited)

- **D-pad inputs processed:** App receives key events without errors.
- **Focus visible:** No focus indicator on pairing screen (expected — no focusable elements on pairing screen).
- **No crashes from D-pad input:** PASS.
- **Cannot test content-screen navigation** without paired state.

---

## E: Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Hardcoded secrets | **CLEAN** | No API keys, passwords, or tokens in source code |
| Token storage | **INSECURE** | Device JWT stored in plain SharedPreferences (C2) |
| Network security | **PARTIAL** | HTTPS used for production, but cleartext allowed globally (C8) |
| Code obfuscation | **ENABLED** | R8 with shrinkResources for release builds |
| WebView debugging | **INSECURE** | Enabled in release build (C1) |
| Mixed content | **INSECURE** | MIXED_CONTENT_ALWAYS_ALLOW in all builds (C9) |
| Exported components | **PARTIAL** | BootReceiver exported without permission (C10) |
| `.env` in git | **CLEAN** | `.env` is gitignored; `.env.example` has safe placeholders |
| Debug flags in release | **FAIL** | `webContentsDebuggingEnabled: true` in compiled config (C1) |
| HTML content sandboxing | **PARTIAL** | Iframe sandbox used but allows scripts (C12) |

---

## F: Production Readiness Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Release build compiles without errors | **PASS** |
| 2 | Release signing configured with production keystore | **FAIL** — No keystore exists |
| 3 | ProGuard/R8 enabled and rules correct | **PASS** (default rules) |
| 4 | No hardcoded API keys, secrets, or test credentials | **PASS** |
| 5 | No hardcoded staging/localhost URLs — base URL configurable | **PASS** — URLs from .env/Preferences |
| 6 | `android:debuggable` false in release | **PASS** (Gradle default) |
| 7 | Logging disabled or minimal in release | **FAIL** — `console.log` everywhere, no log-level gating |
| 8 | Crash reporting configured (Crashlytics, Sentry) | **FAIL** — No crash reporting |
| 9 | App auto-starts on device boot | **PASS** — BootReceiver configured |
| 10 | App recovers from crashes automatically | **FAIL** — No auto-restart mechanism |
| 11 | WebSocket reconnects with exponential backoff | **PARTIAL** — Reconnects but max delay only 5s |
| 12 | Content fallback when offline | **FAIL** — No persisted playlist for offline playback |
| 13 | No memory leaks during extended playback | **UNKNOWN** — Moderate growth observed, needs longer test |
| 14 | TV launcher banner and icon provided | **PARTIAL** — Uses mipmap icon as banner (not proper 320x180 banner) |
| 15 | Min/Target SDK versions appropriate | **PASS** |
| 16 | App permissions are minimal and justified | **PASS** — INTERNET, NETWORK_STATE, BOOT_COMPLETED, WAKE_LOCK |
| 17 | Version name and version code set correctly | **PARTIAL** — Version 1.0.0/1, no auto-increment strategy |
| 18 | Play Store / distribution metadata ready | **PARTIAL** — `store-listing/` exists with SVG assets |
| 19 | WebView debugging disabled in release | **FAIL** — Enabled in compiled config |
| 20 | Mixed content mode restricted in release | **FAIL** — ALWAYS_ALLOW in all builds |

**Result: 7 PASS, 6 FAIL, 5 PARTIAL, 2 UNKNOWN**

---

## G: Prioritized Fix List

### CRITICAL — Must Fix Before Any Production Deployment

| # | Issue | ID | Effort |
|---|-------|----|--------|
| 1 | Release APK signing — generate keystore | C4 | Small |
| 2 | WebView debugging enabled in release build | C1 | Small |
| 3 | `clear_cache` wipes device credentials | C3 | Small |
| 4 | Device token in plain SharedPreferences | C2 | Medium |

### HIGH — Should Fix Before Production, Significant Risk If Not

| # | Issue | ID | Effort |
|---|-------|----|--------|
| 5 | No crash recovery/auto-restart | C5 | Medium |
| 6 | No offline fallback content | C6 | Medium |
| 7 | WebSocket reconnection too aggressive | C7 | Small |
| 8 | `usesCleartextTraffic="true"` in manifest | C8 | Small |
| 9 | `MIXED_CONTENT_ALWAYS_ALLOW` in all builds | C9 | Small |
| 10 | BootReceiver exported without permission | C10 | Small |
| 11 | Pairing retry has no backoff or limit | C11 | Small |
| 12 | No content validation for HTML templates | C12 | Medium |

### MEDIUM — Fix Soon After Launch

| # | Issue | ID | Effort |
|---|-------|----|--------|
| 13 | Splash screen shows Capacitor logo | C13 | Small |
| 14 | Extensive `any` types | C14 | Medium |
| 15 | Video elements not properly cleaned up | C15 | Small |
| 16 | Cache manifest saved on every read | C16 | Small |
| 17 | Pairing poll edge cases | C17 | Small |
| 18 | `versionCode` not auto-incremented | C18 | Small |
| 19 | No burn-in prevention | C19 | Medium |

### LOW — Fix When Convenient

| # | Issue | ID | Effort |
|---|-------|----|--------|
| 20 | `.env` / `.env.example` URL inconsistency | C20 | Trivial |
| 21 | Debug APK double-suffix filename | C21 | Trivial |
| 22 | 7 unused resources | C22 | Trivial |
| 23 | Manifest element ordering | C23 | Trivial |
| 24 | Missing monochrome adaptive icon | C24 | Small |
| 25 | Minimal test coverage | C25 | Large |

---

## H: Recommendations

### Architecture Improvements

1. **Separate dev/prod build configurations explicitly** — The `isDev` pattern in `capacitor.config.ts` is fragile. Use Capacitor's built-in environment handling or separate config files per environment.
2. **Add a lightweight watchdog service** — A foreground Android Service that monitors the WebView and restarts the Activity if it becomes unresponsive. Essential for 24/7 signage.
3. **Implement playlist persistence** — Store the last known playlist and content manifest in Preferences so the device can function offline after restart.
4. **Consider migrating sensitive storage** — Use a custom Capacitor plugin wrapping Android's `EncryptedSharedPreferences` for device tokens.

### Testing Strategy

1. **Unit tests:** Expand `cache-manager.spec.ts` to cover download, eviction, and error paths. Add tests for URL transformation logic.
2. **Integration tests:** Mock Socket.IO and Capacitor plugins to test the full `VizoraAndroidTV` class lifecycle.
3. **Emulator tests:** Create an Android TV AVD (API 34 TV system image) for realistic testing.
4. **Automated smoke tests:** ADB-based script that installs APK, launches app, verifies pairing screen appears, checks logcat for errors.

### Monitoring Strategy

1. **Add Crashlytics or Sentry** for crash reporting and ANR detection.
2. **Implement structured logging** with log levels (debug/info/warn/error) and disable debug logging in release.
3. **Report heartbeat metrics** to the backend: memory usage, uptime, crash count, cache stats.
4. **Server-side monitoring** for device last-seen timestamps to detect devices that have gone offline.

### OTA Update Strategy

1. **Capacitor Live Update** — Consider `@capawesome/capacitor-live-update` for pushing web layer updates without redeploying the APK.
2. **APK updates** — For native changes, implement a self-update mechanism (download new APK, prompt install) or use Google Play's managed distribution.
3. **Version checking** — Add a version check on WebSocket connect so the server can instruct outdated devices to update.

---

**END OF AUDIT — STOP HERE. AWAITING REVIEW BEFORE ANY FIXES.**
