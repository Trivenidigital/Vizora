# Detach Vizora Android TV App into Standalone Repository

Extract `display-android/` from the Vizora monorepo into its own standalone repo (`vizora-tv`).

## Context

- **Framework**: Capacitor 6 + Vite + TypeScript (NOT native Kotlin/Java)
- **Package ID**: `com.vizora.display`
- **Source files**: `src/main.ts`, `src/cache-manager.ts`, `src/secure-storage.ts` + 4 Java files in `android/`
- **Monorepo imports**: Zero. No `@vizora/*` imports, no `../../` imports. Fully self-contained.
- **Config**: URLs via Vite env vars (`VITE_API_URL`, `VITE_REALTIME_URL`, `VITE_DASHBOARD_URL`)
- **Existing docs**: `BUILD_INSTRUCTIONS.md`, `GOOGLE_PLAY_PUBLISHING.md`, `.env.example`, `store-listing/`

## PHASE 1: Audit & Plan

### Step 1: Verify zero monorepo coupling

Confirm there are no hidden dependencies:

```
- [ ] No imports from ../../ or @vizora/* in src/
- [ ] capacitor.config.ts has no monorepo-relative paths
- [ ] vite.config.ts has no monorepo-relative paths or aliases
- [ ] package.json has no workspace:* dependencies
- [ ] No references to monorepo root scripts or nx tasks
- [ ] tsconfig.json has no path mappings to monorepo packages
```

### Step 2: Inventory what to extract

List every file in `display-android/` excluding `node_modules/` and `android/app/build/`. This is the extraction set.

### Step 3: Document the communication protocol

Scan `src/main.ts` and document:
- API endpoints called (REST)
- WebSocket events sent/received
- Auth mechanism (device JWT)
- Pairing flow
- Heartbeat/status reporting

### Step 4: Write `android-detach-plan.md`

- File inventory (count)
- Confirmed: zero monorepo dependencies
- Communication protocol summary
- Monorepo cleanup plan (what to remove, what to update)

**STOP here. Wait for review before Phase 2.**

---

## PHASE 2: Extract

### Step 1: Create standalone repo

```bash
# From parent directory of monorepo
mkdir ../vizora-tv
cd ../vizora-tv
git init

# Copy everything except node_modules and build artifacts
# (use rsync, robocopy, or manual copy)
```

### Step 2: Copy files

Copy the entire `display-android/` contents (minus `node_modules/`, `android/app/build/`, `.gradle/`) into `vizora-tv/` root. Flatten — don't nest inside a `display-android/` subdirectory.

### Step 3: Clean up for standalone use

- Update `package.json`: remove `@vizora/display-android` scoped name if needed, set `"name": "vizora-tv"`
- Verify `.gitignore` covers `node_modules/`, `dist/`, `android/app/build/`, `.gradle/`, `.env`, `local.properties`
- Ensure `.env.example` is present (already exists)
- Ensure `BUILD_INSTRUCTIONS.md` works without "cd display-android" context

### Step 4: Add project documentation

**README.md** — What it is, prerequisites, quick start, build commands, deployment options. Consolidate from existing `BUILD_INSTRUCTIONS.md` and `GOOGLE_PLAY_PUBLISHING.md`.

**CLAUDE.md** — Claude Code context:
- Capacitor 6 + Vite + TypeScript architecture
- 3 TypeScript source files + 4 Java native files
- Communication: REST API + WebSocket (Socket.IO) to Vizora backend
- Build: `npm run build && npx cap sync android` then Android Studio
- Config via `VITE_*` env vars
- Key flows: pairing, content push, heartbeat, boot auto-start

### Step 5: Verify standalone build

```bash
cd vizora-tv
npm install
npm run build          # Vite builds to dist/
npx cap sync android   # Syncs web assets to Android project
```

Build must succeed with zero errors and zero monorepo references.

### Step 6: Clean up monorepo

- Remove `display-android/` directory from monorepo
- Update monorepo root `README.md` — note Android TV app lives at `vizora-tv` repo
- Remove any `display-android` references from `package.json` workspaces (if present)
- Remove any nx project config for display-android (if present)
- Verify monorepo still builds: `npx nx build @vizora/middleware`, `npx nx build @vizora/web`, `npx nx build @vizora/realtime`
- Verify all existing tests still pass

---

## Verification Checklist

### Standalone repo
- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds (Vite)
- [ ] `npx cap sync android` succeeds
- [ ] Android project opens in Android Studio
- [ ] Debug APK builds via Android Studio or `./gradlew assembleDebug`
- [ ] Zero imports referencing the monorepo
- [ ] `.env.example` has all required vars
- [ ] README.md has complete setup instructions

### Monorepo (after removal)
- [ ] All 3 services build (middleware, web, realtime)
- [ ] All existing tests pass
- [ ] No broken references to display-android
- [ ] Backend API/WebSocket endpoints for devices are untouched

### Documentation
- [ ] README.md
- [ ] CLAUDE.md
- [ ] BUILD_INSTRUCTIONS.md (carried over)
- [ ] GOOGLE_PLAY_PUBLISHING.md (carried over)

---

## Hard Rules

- Do NOT change the communication protocol (API endpoints, WebSocket events, auth tokens)
- Do NOT change the package ID (`com.vizora.display`)
- Do NOT modify any backend code — API/WebSocket handlers stay in the monorepo
- The standalone repo must build with ZERO monorepo dependencies
- The monorepo must work with ZERO Android app dependencies
- Existing paired devices must continue to work after detach
- Git history preservation is nice-to-have, not required — fresh git init is fine
- Do NOT remove `display-android/` from monorepo until standalone build is verified
