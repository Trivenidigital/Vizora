# Codebase Navigator

## Search Strategy

1. Grep component name / error text across the repo
2. Follow imports from matched files (1 level deep)
3. Find associated test files (`*.spec.ts`, `*.test.ts`, `*.test.tsx`)
4. Cap results at 15 files with relevance notes

## Domain Search Paths

### Displays / Devices
```
web/src/components/Device*
web/src/app/dashboard/devices/
web/src/lib/hooks/useSocket*
middleware/src/modules/displays/
realtime/src/gateways/device.gateway.ts
packages/database/prisma/schema.prisma  (Display, DisplayGroup models)
```

### Content
```
web/src/app/dashboard/content/
web/src/components/content/
middleware/src/modules/content/
middleware/src/modules/content/data-sources/
packages/database/prisma/schema.prisma  (Content model)
```

### Templates
```
web/src/components/templates/
web/src/components/template-editor/
web/src/app/dashboard/templates/
middleware/src/modules/template-library/
```

### Playlists
```
web/src/app/dashboard/playlists/
web/src/components/playlist/
middleware/src/modules/playlists/
packages/database/prisma/schema.prisma  (Playlist model)
```

### Schedules
```
web/src/app/dashboard/schedules/
middleware/src/modules/schedules/
packages/database/prisma/schema.prisma  (Schedule model)
```

### Auth
```
web/src/app/(auth)/
web/src/lib/auth/
middleware/src/modules/auth/
middleware/src/modules/common/guards/
```

### Dashboard / UI
```
web/src/app/dashboard/
web/src/app/dashboard/page.tsx
web/src/components/dashboard/
web/src/components/ui/
```

### Realtime / WebSocket
```
realtime/src/gateways/
realtime/src/services/
web/src/lib/hooks/useSocket.ts
web/src/lib/hooks/useRealtimeEvents.ts
```

### Support
```
web/src/components/support/
middleware/src/modules/support/
```

### Organizations / Users
```
middleware/src/modules/organizations/
middleware/src/modules/users/
web/src/app/dashboard/settings/
```

## Search Techniques

**Primary:** Use Grep with the component/error text to find entry points.

```bash
# Find component by name
grep -r "DevicePreview" web/src/ --include="*.tsx" --include="*.ts" -l

# Find API endpoint
grep -r "/displays" middleware/src/ --include="*.ts" -l

# Find test files for a module
find middleware/test/ -name "*display*"
find web/src/ -name "*Device*.test.*"
```

**Secondary:** Use Glob for pattern-based file discovery.

```bash
# All files in a module
glob "middleware/src/modules/displays/**/*.ts"

# All components matching a pattern
glob "web/src/components/**/Device*.tsx"
```

**Follow imports:** Read the top 30 lines of matched files to trace dependencies.

## Output Format

Return files as a ranked list:

```
1. web/src/components/DevicePreviewModal.tsx (L45-120) — main preview component
2. web/src/app/dashboard/devices/page.tsx (L1-30) — page that renders preview
3. middleware/src/modules/displays/displays.service.ts (L80-95) — API endpoint
4. web/src/lib/hooks/useSocket.ts (L1-50) — realtime data hook
5. middleware/test/displays.e2e-spec.ts — existing E2E tests
```

Include line ranges for targeted reading. Never dump full files.
