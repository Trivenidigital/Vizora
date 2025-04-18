# Technical Context: Vizora

**Monorepo:** PNPM Workspaces manage dependencies and inter-package linking.
**Languages:** TypeScript (strict mode preferred) across all packages. JavaScript for Node.js backend (`VizoraMiddleware`) where applicable (consider migrating fully to TS).
**Frontend Framework:** React with Vite for fast development and builds (`VizoraWeb`, `VizoraTV`, `VizoraDisplay`).
**Styling:** Tailwind CSS exclusively for consistency and utility-first approach. No CSS Modules, inline styles, or SCSS. `class:` directive preferred over complex ternaries in class attributes.
**UI Primitives:** Shadcn/UI, Radix UI, Lucide Icons (or Heroicons as observed) used for modern UI elements in `VizoraWeb`. `vizoratv` uses minimal UI, potentially custom components or headless UI.
**Backend Framework:** Node.js with Express for REST API and request handling (`VizoraMiddleware`).
**Real-time Communication:** Socket.IO for WebSocket communication between `VizoraMiddleware`, `VizoraWeb`, and `VizoraTV`. Managed via centralized `ConnectionManager` in `@vizora/common`. All apps use the root namespace (`/`).
**Database:** MongoDB (via Mongoose likely) for storing device information, user data, content metadata, and schedules (`VizoraMiddleware`).
**Shared Logic:** `@vizora/common` is a critical package containing:
    - `ConnectionManager`: Abstracts Socket.IO client logic, state, reconnection.
    - `DeviceManager`: Handles device registration, ID persistence, and potentially device-specific commands/events.
    - `PairingStateManager`: Manages the state machine for device pairing.
    - Shared Types/Interfaces: Ensures consistency across the platform.
    - Constants: `PairingState`, `RegistrationState`, etc. (using `as const` objects).
**API:** RESTful principles for the `/api/*` endpoints served by `VizoraMiddleware`.
**Content Rendering:** Handled by `VizoraDisplay`, likely using standard browser capabilities (img, video, iframe tags).
**Authentication:** JWT for `VizoraWeb`. Device authentication/pairing managed via `PairingStateManager` and tokens/IDs stored securely.
**Development Environment:**
    - Vite handles frontend dev servers and builds.
    - Nodemon (likely) for backend development server restarts.
    - `VITE_API_URL` environment variable used by frontends to locate the backend.
    - PowerShell requires `;` instead of `&&` for chained commands.
**Build Process:** Each package likely has its own build script (e.g., `vite build`, `tsc`). `@vizora/common` built separately (`tsc --project tsconfig.build.json`) for distribution.

## Technologies Used

### Frontend
- **React 18**: Core UI framework
- **TypeScript**: Type safety and development experience
- **Vite**: Fast build tooling and development server
- **TailwindCSS**: Utility-first CSS framework
- **Shadcn/UI**: Component primitives built on Radix UI
- **Socket.IO Client**: Real-time communication
- **React Router**: Client-side routing
- **Lucide Icons**: Modern iconography

### Backend
- **Node.js**: Runtime environment
- **Express**: Web server framework
- **Socket.IO**: WebSocket server for real-time updates
- **MongoDB**: Database for persistent storage
- **Zod**: Runtime type validation
- **JWT**: Authentication token system

### Development Tools
- **ESLint**: Code quality and consistency
- **Vitest/Jest**: Testing frameworks
- **Playwright**: End-to-end testing

## Development Setup

### Environment Setup
- Node.js 16+ required
- MongoDB instance (local or cloud)
- CORS properly configured for local development
- Environment variables (.env files) for configuration

### Project Structure
```
Redesign/
  ├── VizoraWeb/        # Admin interface
  ├── VizoraTV/         # Display application
  ├── VizoraMiddleware/ # Backend services
  ├── VizoraDisplay/    # Content orchestration
  └── common/           # Shared utilities and types
```

### Running the Applications
1. Start the middleware server: `cd Redesign/VizoraMiddleware && npm run dev`
2. Start the web admin: `cd Redesign/VizoraWeb && npm run dev`
3. Start the TV application: `cd Redesign/VizoraTV && npm run dev`

### Socket.IO Connection
All applications connect to the Socket.IO server through the `ConnectionManager` in the common package:
```typescript
const connectionManager = getConnectionManager();
connectionManager.connect({
  auth: { token: authToken }
});
```

## Technical Constraints

### Performance
- Content delivery optimized for various network conditions
- Socket.IO connection with exponential backoff for reliability
- Component lazy-loading for faster initial loads
- Efficient state management to avoid unnecessary re-renders

### Security
- JWT-based authentication for all connections
- Token validation on both client and server
- Socket connections authenticated via token
- Content validation to prevent malicious uploads
- HTTPS required for production

### Compatibility
- Browser support: Latest 2 versions of major browsers
- TV platforms: Modern smart TVs with web browsers
- Mobile support for admin interface
- Responsive design for various screen sizes

## Dependencies
- Socket.IO v4.x used for WebSocket communication
- TailwindCSS v3.x for styling
- MongoDB v5+ for data storage
- React v18+ for UI development
- TypeScript v4.5+ for type safety

## Tool Usage Patterns

### Socket.IO
- Root namespace (`"/"`) for all connections
- Connection manager as singleton instance
- Event-based communication with standardized naming
- Authentication via token in connection options
- Reconnection handling with exponential backoff

### Testing
- Unit tests with Vitest/Jest
- UI component testing with Testing Library
- End-to-end testing with Playwright
- Socket communication mocking for reliable tests

### Deployment
- Docker containers for each application
- Environment-specific configuration via .env files
- CI/CD pipeline for automated testing and deployment 

# System Patterns: Vizora

**Architectural Style:** Modular Monorepo with distinct packages for different concerns (Backend, Web Admin, TV Client, Display Engine, Common Logic). Microfrontend-like separation.

**Core Communication:**
- **Client-Server (Web):** REST API (`VizoraWeb` <-> `VizoraMiddleware`) for data fetching, updates, uploads.
- **Real-time:** WebSockets (Socket.IO) for status updates, pairing events, content pushes, commands (`VizoraWeb`/`VizoraTV` <-> `VizoraMiddleware`).

**State Management:**
- **`@vizora/common`:** Centralizes core state machines (`PairingStateManager`) and connection state (`ConnectionManager`). Uses an event-driven approach (EventEmitter/Observables) for state change notifications.
- **`VizoraTV`:** Uses `DisplayContext` which integrates and wraps the common managers (`ConnectionManager`, `DeviceManager`, `PairingStateManager`) to provide state and actions to UI components.
- **`VizoraWeb`:** Likely uses standard React context or state management libraries (e.g., Zustand, Jotai, Redux Toolkit - check implementation) for UI state, potentially combined with React Query/SWR for server data caching.

**Key Patterns:**
- **Singleton Services (within context/scope):** Instances of `ConnectionManager`, `DeviceManager`, `PairingStateManager` are typically intended to be singletons within their operational context (e.g., within `DisplayContext` for `VizoraTV`).
- **Event-Driven Architecture:** Core managers in `@vizora/common` emit events (`PairingEvent.STATE_CHANGE`, `connectionStateChange`, `DeviceEvent.*`) to decouple components and notify consumers of state changes.
- **Provider Pattern:** React Context (`DisplayContext` in `VizoraTV`) used to provide access to state and actions down the component tree.
- **Facade Pattern:** `PairingStateManager` acts as a facade, coordinating interactions between `ConnectionManager` and `DeviceManager` for the specific task of pairing. `DisplayContext` acts as a facade over the underlying managers for the UI.
- **Alias-based Imports:** TypeScript paths (`@/*`, `@vizora/common`, `@vizora/display`) used for clean, absolute imports between and within packages.
- **Constants as Objects (`as const`):** Replacing enums for better tree-shaking and ESM compatibility.

**Data Flow (Pairing & Content):**
1.  `VizoraTV` connects (`ConnectionManager`).
2.  `VizoraTV` registers/verifies (`DeviceManager`, `PairingStateManager`).
3.  `VizoraTV` requests pairing code (`PairingStateManager` -> `Middleware`).
4.  `VizoraWeb` scans QR, sends pairing confirmation to `Middleware`.
5.  `Middleware` validates, updates device status, broadcasts confirmation (`device:paired`).
6.  `VizoraTV` receives confirmation (`PairingStateManager` updates state).
7.  `VizoraTV`'s `DisplayScreen` potentially requests playlist *or* `Middleware` pushes playlist (`playlist:push` event).
8.  `VizoraTV`'s `DisplayScreen` receives playlist, passes it to `VizoraDisplay`'s `DisplayRenderer`.
9.  `DisplayRenderer` manages playback and transitions.

**Error Handling:**
- API calls use try/catch and check response status. `apiClient` likely centralizes some error handling.
- Socket errors handled by `ConnectionManager` and specific operation handlers (e.g., within `PairingStateManager`).
- Errors propagated via events (`PairingEvent.PAIRING_ERROR`) or state updates.
- UI displays user-friendly error messages and potentially retry/reset actions.
- Retry logic incorporates throttling and backoff (`PairingStateManager`, `ConnectionManager`). 

# Active Context: Vizora (Initialization - 2025-April)

**Current Focus:** Completing the core implementation of the `VizoraTV` application, ensuring it correctly integrates with `@vizora/common` services and delegates rendering to `VizoraDisplay`.

**Recent Changes:**
- **Service Refactoring:**
    - Standardized `contentService` usage in `VizoraWeb`, ensuring it uses `@vizora/common` via a local wrapper.
    - Updated `@vizora/common` exports for clarity and completeness.
    - Refactored `VizoraTV`'s `DisplayContext` to initialize and use centralized managers (`ConnectionManager`, `DeviceManager`, `PairingStateManager`) from `@vizora/common`.
    - Verified `TokenManager` usage in `VizoraWeb`'s `apiClient`.
    - Confirmed `VizoraDisplay` contains specialized rendering logic, distinct from `vizoratv`.
- **`VizoraTV` Implementation:**
    - Implemented routing in `AppContent.tsx` based on pairing state from `DisplayContext`.
    - Implemented `PairingScreen.tsx` to connect to `DisplayContext`, show pairing info/status/errors, and handle user actions (start/reset).
    - Updated `DisplayScreen.tsx` to connect to `DisplayContext`, manage a `playlist` state (based on events), and import `DisplayRenderer` from `@vizora/display`.
- **Configuration:**
    - Added/verified path aliases (`@/*`, `@vizora/common`, `@vizora/display`) in `tsconfig.app.json` and `vite.config.ts` for both `VizoraWeb` and `VizoraTV`.
- **Utilities:**
    - Created `logger.ts` utility in `vizoratv`.
    - Confirmed existence of `LoadingSpinner.tsx` in `vizoratv`.

**Next Steps:**
1.  **Verify `VizoraDisplay` Integration:** Ensure `vizoratv`'s `DisplayScreen` correctly interacts with `VizoraDisplay`'s `DisplayRenderer`, passing the playlist. Confirm event names for playlist updates (`playlist:push`?) match the backend implementation.
2.  **Implement `ContentRenderer`:** Confirm the `ContentRenderer.tsx` file was created in `VizoraDisplay` and refine its implementation for robust handling of image, video, and webpage types, including transitions and error states.
3.  **Testing:** Run `VizoraTV` to test the pairing flow, transition to the display screen, and observe content rendering (initially might be empty or use placeholders until playlist fetching is fully wired).
4.  **Refine Playlist Handling:** Implement the mechanism for `VizoraTV` to receive the actual playlist from the `Middleware` after pairing (confirm event name or implement request logic).

**Open Questions/Decisions:**
- What is the exact event name emitted by `Middleware`/`DeviceManager` for pushing the playlist/schedule to `VizoraTV`? (Currently assumed `playlist:push`).
- Does `VizoraTV` need to explicitly request the playlist after pairing, or does the server push it automatically?
- Does the `ContentRenderer` in `VizoraDisplay` need further refinement for specific transition effects or content types beyond image/video/webpage?

**Learnings/Patterns:**
- Importance of adhering strictly to the defined package roles in the architecture manifest.
- Necessity of confirming file existence and location before suggesting edits or creations.
- The `edit_file` tool can be unreliable for large replacements; manual updates or alternative strategies may be needed.
- Centralized managers in `@vizora/common` are effectively used via Context API in `VizoraTV`. 

# Progress: Vizora (Initialization - 2025-April)

**What Works:**
- **Core Architecture:** Monorepo structure established with distinct packages (`common`, `Middleware`, `Web`, `TV`, `Display`).
- **Common Services:** `ConnectionManager`, `DeviceManager`, `PairingStateManager` implemented in `@vizora/common`.
- **VizoraWeb (Partial):**
    - Basic structure likely exists.
    - `contentService` refactored to use common logic.
    - `apiClient` uses `TokenManager` interceptor.
    - Path aliases configured.
- **VizoraTV (Core Implemented):**
    - `DisplayContext` set up to use common managers.
    - `AppContent` handles routing based on pairing state.
    - `PairingScreen` connects to context, displays status/codes/errors, handles actions.
    - `DisplayScreen` connects to context, manages playlist state placeholder, imports `DisplayRenderer` from `@vizora/display`.
    - Path aliases configured.
    - Utilities (`logger`, `LoadingSpinner`) in place.
- **VizoraDisplay (Assumed Partial/Exists):**
    - Contains `DisplayRenderer` and `ContentPlayer` (based on file search).
    - Contains `PlaybackEngine`, `PreloadManager`, `CacheStorage` services.
- **VizoraMiddleware (Assumed Partial/Exists):**
    - Basic Express app, Socket.IO server setup likely exists.
    - Device pairing logic (issuing codes, validation) assumed functional based on TV app structure.
    - Broadcasting mechanism for events like `device:paired` exists.

**What's Left to Build/Refine:**
- **`VizoraTV` <-> `Middleware` Playlist Sync:**
    - Confirm/implement the event (`playlist:push`?) used by Middleware to send the playlist.
    - Implement logic in `DisplayScreen` to correctly receive and update the playlist state based on this event.
    - Determine if an initial playlist request from `VizoraTV` is needed.
- **`VizoraDisplay` - `ContentRenderer` Refinement:**
    - Ensure `ContentRenderer.tsx` exists in the correct location (`Redesign/VizoraDisplay/src/components/content/`).
    - Enhance rendering logic for robustness (error handling per type, smooth transitions between items based on `DisplayRenderer`'s engine).
    - Add support for any other required content types.
- **`VizoraWeb`:**
    - Implement UI for content scheduling.
    - Implement UI for device management and status viewing.
    - Fully integrate content upload flow.
- **`VizoraMiddleware`:**
    - Implement playlist/schedule storage and retrieval (MongoDB).
    - Implement endpoint/socket event for sending playlists to `VizoraTV`.
    - Implement content upload handling and storage integration.
    - Implement API endpoints needed by `VizoraWeb` (scheduling, device management).
- **Testing:** End-to-end testing of the pairing flow, content push, and display rendering. Unit/integration tests for key components and services.

**Current Status:** `VizoraTV`'s core UI and state management flow is implemented, connecting to the common services. It's ready to integrate with `VizoraDisplay` for rendering and receive actual playlist data from the `Middleware`. `VizoraWeb` and `Middleware` functionalities related to playlist management and content upload need implementation.

**Known Issues:**
- Persistent issues with the `edit_file` tool applying large changes to `PairingScreen.tsx` required manual intervention/workarounds.
- The exact event name for playlist pushes from `Middleware` to `VizoraTV` needs confirmation.

**Decisions Log:**
- Confirmed `ContentRenderer` belongs in `VizoraDisplay`, not `vizoratv`.
- Centralized TV state management in `DisplayContext`, integrating common managers.
- Standardized path alias usage across frontends. 