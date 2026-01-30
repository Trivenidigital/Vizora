# Critical Fixes Implementation Plan

## Changes to be made:

### 1. Device Pairing Endpoint (BLOCKER-002)
- Add JwtModule import to displays.module.ts
- Add /pair endpoint to displays.controller.ts
- Add generatePairingToken method to displays.service.ts
- Generate device JWT with proper claims

### 2. Playlist Creation Fix (BLOCKER-001)
- Add validation to check if content exists before creating playlist
- Add better error handling for foreign key constraints
- Return meaningful error messages

### 3. Playlist Assignment (BLOCKER-003)
- Add currentPlaylistId field to Display schema
- Create migration
- Update DTOs to accept currentPlaylistId
- Update service to handle assignment

### 4. Testing Guide Updates
- Fix field names (deviceId vs deviceIdentifier, name vs nickname)
- Fix organization endpoint (/organizations/me vs /organizations/:id)
- Remove HTML content test (not supported)
- Add firstName/lastName to registration
- Update response format expectations
- Fix device pairing endpoint path

## Files to modify:
1. packages/database/prisma/schema.prisma
2. middleware/src/modules/displays/displays.module.ts
3. middleware/src/modules/displays/displays.controller.ts
4. middleware/src/modules/displays/displays.service.ts
5. middleware/src/modules/displays/dto/update-display.dto.ts
6. middleware/src/modules/playlists/playlists.service.ts
7. VIZORA_MANUAL_TESTING_GUIDE.md

Let's begin...
