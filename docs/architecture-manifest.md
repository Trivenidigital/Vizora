# 📐 Vizora Architecture Manifest

This document defines the locked architecture rules for all Vizora applications. These rules must be followed by all contributors and automated tools (e.g., Cursor, Linters, CI) to ensure consistency, scalability, and maintainability.

---

## 🔧 Project Structure

Redesign/ ├── common/ # Shared services, types, socket managers, and utils ├── VizoraWeb/ # Admin portal ├── VizoraTV/ # TV app (device-based content rendering) ├── VizoraDisplay/ # Rendering and scheduling engine ├── VizoraMiddleware/ # Node.js API backend

---

## 🧭 Architectural Rules

### 1. Centralized Services

- All shared API/service logic must live in `Redesign/common/services/`
- Examples: `contentService`, `deviceService`, `tokenService`, etc.
- No services should be duplicated inside VizoraWeb, VizoraTV, or VizoraDisplay.

### 2. Socket & Auth Management

- WebSocket logic must use `ConnectionManager` from `@vizora/common`
- Auth logic must use `TokenManager` from `@vizora/common`
- No app should call `localStorage` or `socket.io` directly

### 3. Import Style

- All shared logic must be imported using:
  ```ts
  import { X } from '@vizora/common';
  ```
  ❌ Do not use:
  
  ../../common
  
  @vizora/common/services/... (deep imports)

### 4. Shared Exports

- All reusable logic must be exported via `Redesign/common/index.ts`
- Export structure should use only named exports (no default exports)

## 🧪 Testing Guidelines

- Tests must mock shared services (contentService, TokenManager, etc.) from `@vizora/common`
- No local mocks for token, socket, or upload logic are allowed
- Shared test utilities should be centralized in `common/mocks` or `common/testUtils`

## 📁 File Ownership

| Module          | Owns                                      |
|-----------------|-------------------------------------------|
| common/         | Services, types, sockets, tokens, utils   |
| VizoraWeb/      | UI, UX, and admin-specific behavior       |
| VizoraTV/       | Pairing, device registration, content playback |
| VizoraDisplay/  | Rendering, scheduling, fallback engine    |
| VizoraMiddleware| All REST API endpoints and DB communication |

## 🛑 What's Not Allowed

- ❌ Duplicate service logic across apps
- ❌ Direct access to localStorage or raw WebSocket APIs
- ❌ Relative imports to common/
- ❌ Deep imports into common/services/...
- ❌ Default exports in any shared file

## ✅ Keep It Clean

This manifest must be followed for all development, code reviews, and refactors. Please raise an architectural RFC if a new pattern or service abstraction is required.

---

## 🔧 Bonus: tsconfig.paths.json Snippet

You can add this to your `tsconfig.json`:

```json
"compilerOptions": {
  "baseUrl": ".",
  "paths": {
    "@vizora/common": ["../common"]
  }
}
```

And in `vite.config.ts`:

```ts
resolve: {
  alias: {
    '@vizora/common': path.resolve(__dirname, '../common'),
  },
},
``` 