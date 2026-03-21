# Decisions Log

## Session Zero -- 2026-03-08

Initial codebase analysis and architectural decisions documentation.

### Architectural Decisions

#### D1: Dual JWT Authentication
**Decision**: Separate JWT secrets for users (`JWT_SECRET`) and display devices (`DEVICE_JWT_SECRET`).
**Why**: Devices and users have fundamentally different auth lifecycles. Devices authenticate once during pairing and maintain long-lived tokens. Users have standard login/logout flows. Separate secrets allow independent rotation and different expiration policies.
**Impact**: Every auth guard must check which token type is being used. WebSocket handshake uses device JWT.

#### D2: Dual Persistence for Device Status
**Decision**: Write device online/offline status to both Redis (fast reads) and PostgreSQL (persistence).
**Why**: Redis provides sub-millisecond reads for real-time dashboard updates. PostgreSQL ensures status survives Redis restarts and supports complex queries (e.g., "devices offline for more than 24 hours").
**Trade-off**: Write amplification -- every status change is two writes. Potential consistency issues if one write succeeds and the other fails.

#### D3: Response Envelope Pattern
**Decision**: Global `ResponseEnvelopeInterceptor` wraps all API responses in `{ success, data, meta }`.
**Why**: Consistent API contract for frontend. Meta field supports pagination. `@SkipEnvelope()` decorator for special cases.
**Impact**: All frontend API parsing expects this envelope. Tests must account for the wrapper.

#### D4: Nx Monorepo with pnpm Workspaces
**Decision**: Nx for orchestration, pnpm for package management.
**Why**: Nx provides build caching, dependency graph, and per-project configuration. pnpm provides strict dependency isolation and disk efficiency.
**Trade-off**: Complex setup. Webpack config for middleware, Next.js for web. Different build systems per package.

#### D5: Cookie-Based Auth (not Bearer tokens)
**Decision**: JWT stored in httpOnly cookie, not localStorage/Bearer headers.
**Why**: httpOnly cookies prevent XSS token theft. CSRF protection added via middleware. More secure for web dashboard.
**Impact**: CSRF middleware required. Device clients use Bearer tokens (different flow).

#### D6: Dual Payment Providers (Stripe + Razorpay)
**Decision**: Support both Stripe and Razorpay, selected per organization.
**Why**: Razorpay required for Indian market (UPI, Indian card networks). Stripe for international.
**Impact**: Organization model has `paymentProvider` field. Billing module must handle both APIs. Plan prices stored in both currencies.

#### D7: Template HTML Exempted from Sanitization
**Decision**: `templateHtml`, `htmlContent`, `customCss` fields skip the SanitizeInterceptor.
**Why**: Templates are admin-created HTML/CSS that must preserve styling. Sanitizing would strip legitimate CSS and HTML structures.
**Risk**: Admin-injected XSS possible. Mitigated by admin-only template creation.

#### D8: Single-Worker Playwright Tests
**Decision**: Playwright runs with 1 worker, no parallelism.
**Why**: Tests share a single PostgreSQL database. Parallel tests cause race conditions on shared data.
**Trade-off**: Slower test runs (~5-10min for full suite).

#### D9: Port Validation at Startup
**Decision**: Middleware and realtime validate their assigned port at startup and exit if misconfigured.
**Why**: Prevents silent misconfiguration where a service starts on wrong port but appears healthy.
**Ports**: Middleware 3000, Web 3001, Realtime 3002 -- hardcoded and enforced.

#### D10: DataSourceRegistry Pattern
**Decision**: Content service uses a registry pattern instead of individual constructor injections for data sources.
**Why**: Extensibility -- new content types can register data sources without modifying the service constructor.
**Impact**: Tests must mock the registry with `.get(type)` method, not individual services.

### Technical Debt

#### TD1: Indian Category Missing from Create Template Page (RESOLVED in DTOs)
The "indian" category IS correctly included in both `CreateTemplateDto` and `SearchTemplatesDto` `@IsEnum` validation. However, the web dashboard's "Create Template" page (`web/src/app/dashboard/templates/new/page.tsx`) had a hardcoded CATEGORIES array that was missing "indian" — fixed by adding `{ value: 'indian', label: 'Indian Cuisine' }`.
**Status**: Fixed. Backend DTOs were always correct; frontend dropdown was the gap.

#### TD2: Two Parallel Template Seed Systems
Templates are seeded via two different mechanisms:
1. Middleware NestJS command (`middleware/src/modules/template-library/seed/`) -- inline HTML in TypeScript
2. Standalone scripts (`templates/seed/`) -- HTML files seeded via API calls
This creates confusion about which is canonical. The Indian cuisine templates use system 2, while all others use system 1.
**Risk**: Seeds can conflict. Category counts may differ between systems.

#### TD3: Search + Category Filter Conflict
E2E testing revealed that combining search text with category filter produces 0 results. Likely a backend query issue where both filters are AND-joined but the search doesn't account for category field.
**File**: `middleware/src/modules/template-library/template-library.service.ts`

#### TD4: Admin Test Suite Failures (3 suites)
Three web admin test suites fail due to async Client Component rendering in jsdom. This is tied to the RSC (React Server Components) migration deferral -- these components should ideally be Server Components but are kept as Client Components.
**Status**: Known, deferred. Not blocking.

#### TD5: vizora-tv Test Suite Uses Wrong Test Runner Syntax
The Android TV client (`vizora-tv`) spec files use Jest syntax (`describe`, `jest.mock`) but the project is configured for Vitest without `globals: true`. Tests have never actually run.
**Status**: External repo, documented but not fixed.

#### TD6: CI/CD Pipeline Exists But Limited
`.github/workflows/ci.yml` runs lint, test, build, E2E, and security audit. Docker builds on tags via `docker-build.yml`. However, no automated deployment pipeline -- deploy is still manual via SSH + PM2.

#### TD7: Template Editor Limited vs OptiSigns
The visual template editor (iframe + postMessage) supports only basic element editing. No drag-and-drop, no layers, no responsive preview. Significant gap vs OptiSigns' editor capabilities.
**Status**: Functional but not competitive. See `references/competitive-positioning.md`.

#### TD8: AIDesignerModal is Placeholder
`web/src/components/templates/AIDesignerModal.tsx` exists but is likely a placeholder for future AI-powered template generation. Not connected to any AI API.

#### TD9: Web Build Memory Requirements
Web build requires `NODE_OPTIONS="--max-old-space-size=4096"` on machines with limited RAM. Next.js 16 + large bundle.

#### TD10: Billing Plans TODO
`middleware/src/modules/billing/constants/plans.ts` has a TODO: "When changing prices here, create corresponding price objects in Stripe/Razorpay." Currently plan prices may be out of sync with payment provider.

### Partially Built Features

#### PB1: AI Template Designer (~70% Complete)
Polished frontend modal (`AIDesignerModal.tsx`, 307 lines) with prompt input, industry/orientation/style selection, animated generation steps. Calls `apiClient.aiGenerateTemplate()` — if backend returns `{available: true, template}`, shows result; otherwise degrades to "coming soon" screen. Backend likely returns `{available: false}` or 404. No actual AI API integration yet.

#### PB2: Layouts System (Fully Implemented)
Full CRUD backend (`/api/v1/content/layouts/`) with 5 presets (split-horizontal, split-vertical, grid-2x2, main-sidebar, l-shape). Frontend at `/dashboard/layouts` with create modal, preset selection, zone configuration. Layouts stored as Content records with `type: 'layout'`. Resolved layout endpoint fetches all zone content in batch.
**Status**: Production-ready. Backend controllers, DTOs, service methods, and frontend UI all complete.

#### PB3: Widget System (Fully Implemented)
Full CRUD backend (`/api/v1/content/widgets/`) with 7 widget types (weather, rss, social_instagram, social_twitter, social_facebook, clock, countdown). DataSourceRegistry pattern provides config schemas, sample data, default templates, and live data fetchers per type. Frontend at `/dashboard/widgets` with 3-step wizard (select → configure → preview).
**Status**: Production-ready. Backend controllers, DTOs, data sources, service methods, and frontend UI all complete.

#### PB4: Demo Video
Landing page has `DemoVideoSection.tsx`. Remotion-related screenshots in repo root (`remotion-studio-verify.png`). Demo video creation was in progress.

#### PB5: Template Overhaul Plan
Detailed plan exists at `docs/plans/2026-02-26-template-overhaul-plan.md` for replacing the entire template library with OptiSigns-competitive designs. Not yet executed.

### Integration Points That Look Fragile

#### IP1: www vs non-www Origin Mismatch
BUG #6 documented: Server `API_BASE_URL=https://www.vizora.cloud` vs device `apiUrl=https://vizora.cloud` caused 401s on content fetch. Fixed by normalizing, but similar issues could recur with any URL-based comparison.

#### IP2: Pairing Code in Redis Only
Pairing codes are stored in Redis with 5-minute TTL. If Redis goes down during pairing, the flow breaks completely with no fallback.

#### IP3: Device Heartbeat Validation Warnings
vizora-tv sends extra fields not in the DTO validation whitelist. Every 15-second heartbeat generates WARN logs. Non-breaking but very noisy.

#### IP4: SanitizeInterceptor Template Exemption
The sanitizer skips fields by name (`templateHtml`, `htmlContent`, `customCss`). If a new field containing HTML is added without updating the exemption list, it will be sanitized and broken.
