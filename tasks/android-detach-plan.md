# Android TV Detach Plan

## Phase 1 Audit Results

### Monorepo Coupling: ZERO

| Check | Result |
|-------|--------|
| Imports from `../../` in src/ | None |
| Imports from `@vizora/*` in src/ | None |
| `workspace:*` in package.json | None |
| Monorepo paths in vite.config.ts | None (uses `process.cwd()`) |
| Path mappings in tsconfig.json | None |
| Nx project config | None |
| pnpm-workspace.yaml | Listed but only for install resolution — no code coupling |

**Verdict**: The app is already fully self-contained. Extraction is a copy operation.

### File Inventory: 138 files

**Source code (6 files)**:
- `src/main.ts` — App entry point (~1300 lines, all app logic)
- `src/cache-manager.ts` — Content caching with Capacitor Filesystem
- `src/cache-manager.spec.ts` — Unit tests
- `src/secure-storage.ts` — Encrypted storage wrapper
- `src/qrcode.d.ts` — Type declaration for qrcode lib
- `src/vite-env.d.ts` — Vite type declarations

**Native Java (4 files)**:
- `android/app/src/main/java/com/vizora/display/MainActivity.java`
- `android/app/src/main/java/com/vizora/display/BootReceiver.java`
- `android/app/src/main/java/com/vizora/display/SecureStoragePlugin.java`
- `android/app/src/main/java/com/vizora/display/CrashRecoveryHandler.java`

**Config (7 files)**: `package.json`, `capacitor.config.ts`, `vite.config.ts`, `tsconfig.json`, `jest.config.js`, `.env.example`, `.env`

**Build/Gradle (12 files)**: `android/build.gradle`, `android/app/build.gradle`, `android/settings.gradle`, gradle wrapper, etc.

**Android resources (~50 files)**: Splash screens, icons, layouts, manifests, XML configs

**Docs (3 files)**: `BUILD_INSTRUCTIONS.md`, `GOOGLE_PLAY_PUBLISHING.md`, `store-listing/PLAY_STORE_LISTING.md`

**Store listing assets (5 files)**: SVG icons, banner, screenshots

**Build artifacts to EXCLUDE**: `node_modules/`, `android/app/build/`, `android/.gradle/`, `dist/`, `android/capacitor-cordova-android-plugins/build/`, `android/local.properties`

### Communication Protocol

**REST API (2 endpoints)**:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/devices/pairing/request` | Request pairing code (sends deviceName, model, os, screenResolution) |
| GET | `/api/v1/devices/pairing/status/{code}` | Poll pairing status until confirmed |

**WebSocket (Socket.IO to realtime gateway)**:
| Direction | Event | Purpose |
|-----------|-------|---------|
| Emit | `heartbeat` | Send device status (deviceId, status, currentContent, systemInfo) |
| Emit | `content:impression` | Report content view (contentId, duration, zoneId) |
| Listen | `connect` | Connection established — join device/org rooms |
| Listen | `disconnect` | Handle disconnection, trigger reconnect |
| Listen | `connect_error` | Handle auth errors, token refresh |
| Listen | `config` | Receive device configuration updates |
| Listen | `playlist:update` | Receive new playlist content |
| Listen | `command` | Receive commands (reload, restart, etc.) |
| Listen | `qr-overlay:update` | Toggle QR code overlay on screen |

**Auth**: Device JWT token received during pairing, stored in SecureStorage, sent as `auth.token` in Socket.IO handshake and as `Authorization: Bearer` header for REST calls.

**Config**: `VITE_API_URL`, `VITE_REALTIME_URL`, `VITE_DASHBOARD_URL` via Vite env vars. Can also be overridden via URL params or stored Preferences.

### Monorepo Cleanup Plan

1. Remove `display-android/` directory
2. Remove `display-android` from `pnpm-workspace.yaml` (line 7)
3. Update root `README.md` to link to standalone repo
4. No nx config to update (none exists)
5. No shared code to update (none exists)
6. Backend endpoints stay untouched — they serve the detached app

---

**Phase 1 complete. Ready for Phase 2 on approval.**
