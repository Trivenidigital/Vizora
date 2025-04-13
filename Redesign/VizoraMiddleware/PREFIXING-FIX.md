# API Path Double-Prefixing Fix

## Issue Description

The login path was returning:
`Route not found: POST /api/api/auth/login`

This occurred because:

1. The frontend `apiClient` was configured with a `baseURL` that already included `/api`
2. The auth service was then appending `/api/auth/login` to this base URL
3. This resulted in `/api/api/auth/login` which didn't exist on the server

## Root Causes

1. **Frontend Configuration**:
   - `apiClient.ts` sets `baseURL: getBaseUrl()` which returns `http://localhost:3003/api` (already includes `/api`)
   - Service files then added another `/api` prefix to endpoints

2. **Backend Route Definition**:
   - Server only had routes defined with `/api/auth/*` but not `/auth/*`
   - No support for alternate path formats

3. **Lack of Path Standardization**:
   - Inconsistent use of `/api` prefix across the codebase
   - No safeguards against double-prefixing

## Fixes Implemented

### 1. Frontend Service Updates

Updated `authService.ts` to remove the `/api` prefix from all endpoint paths:
- Changed `/api/auth/login` to `/auth/login`
- Changed `/api/auth/register` to `/auth/register`
- Changed `/api/auth/logout` to `/auth/logout`
- Changed `/api/auth/me` to `/auth/me`
- Changed `/api/auth/profile` to `/auth/profile`

This ensures the paths are correctly constructed when combined with the baseURL.

### 2. Backend Route Flexibility

Modified both servers to support multiple path formats:
- Added route handlers for both `/api/auth/*` and `/auth/*` paths
- Used Express route arrays: `app.post(['/api/auth/login', '/auth/login'], ...)`
- Created a `createAuthRoutes()` helper function to centralize route definitions

### 3. Path Debugging

Added enhanced logging to help debug path issues:
- Log the full constructed URL in development mode
- Log both the baseURL and the path being appended
- Clearly indicate the complete path being requested

## Testing

To verify the fix:
1. Start the unified server: `node unified-server.js`
2. The server now handles both formats:
   - `/api/auth/login` (for direct API calls)
   - `/auth/login` (for calls through apiClient with baseURL)
3. The frontend services have been updated to use the correct format

## Preventing Future Issues

To prevent this issue from recurring:

1. **Standardize Path Construction**:
   - Services should NEVER manually add `/api/` if using apiClient
   - If baseURL already includes `/api`, only append the specific path

2. **Explicit Configuration**:
   - Added comments in apiClient.ts clarifying that baseURL already includes `/api`
   - Added debug logs showing the constructed URLs

3. **Server Flexibility**:
   - Servers now support both formats for maximum compatibility
   - Frontend can evolve without breaking existing code

## Related Files

1. Frontend:
   - `Redesign/VizoraWeb/src/lib/apiClient.ts` - Base URL configuration
   - `Redesign/VizoraWeb/src/services/authService.ts` - Auth API calls
   - `Redesign/VizoraWeb/src/services/folderService.ts` - Folder API calls
   - `Redesign/VizoraWeb/src/services/contentService.ts` - Content API calls
   - `Redesign/VizoraWeb/src/services/displayService.ts` - Display API calls

2. Backend:
   - `Redesign/VizoraMiddleware/unified-server.js` - Main backend server
   - `Redesign/VizoraMiddleware/auth-server.js` - Auth-specific server 