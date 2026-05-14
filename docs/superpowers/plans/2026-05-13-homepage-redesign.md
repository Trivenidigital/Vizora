# Vizora Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public homepage's dark/neon/AI positioning with a clean, SMB-focused landing page that communicates operational simplicity and premium confidence.

**Architecture:** Keep the first pass isolated to `/`, a new landing-specific homepage component, landing-local CSS utilities, and direct homepage metadata updates. Leave dashboard routes, shared app tokens, and existing landing modules stable until visual review.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS, Jest + React Testing Library, lucide-react.

---

### File Structure

- Modify: `web/src/app/page.tsx` to render the new homepage component only.
- Create: `web/src/components/landing/OperationalHomepage.tsx` for the 8-section public landing experience.
- Modify: `web/src/app/globals.css` to add `vh-*` landing-only utility classes.
- Modify: `web/src/app/layout.tsx` only for public positioning metadata and theme color.
- Create: `web/src/app/__tests__/homepage.test.tsx` to lock the new homepage message and removal of old AI-first copy.
- Modify: `tasks/todo.md` to track implementation and verification status.

### Task 1: Homepage Positioning Test

- [x] **Step 1: Write the failing homepage test**

Create `web/src/app/__tests__/homepage.test.tsx` with assertions for:
- H1: `Digital signage your team can actually run.`
- Support line: `Schedule once. Runs everywhere.`
- Pricing line: `Simple pricing. No enterprise sales process.`
- `$6/screen` proof
- `Urban Eats` customer proof
- Absence of `AI-powered`, `command center`, and `Intelligence Engine`

- [x] **Step 2: Run test and verify red**

Run: `pnpm --filter @vizora/web test -- --runTestsByPath src/app/__tests__/homepage.test.tsx`

Expected: FAIL against the current homepage because it still renders old command-center/AI messaging.

### Task 2: Isolated Homepage Component

- [x] **Step 1: Create `OperationalHomepage.tsx`**

Build these eight sections:
- Navigation: Product, Solutions, Pricing, Customers, Resources, Login, Start Free
- Hero: brief copy, Start Free, Book Demo, microproof, product dashboard mockup
- Trust: three customer cards
- Core pillars: Create, Schedule, Manage
- Real-world deployments: restaurant, grocery, retail, lobby/waiting room visual cards
- Product simplicity: scheduling UI plus reliability bullets
- Pricing: transparent `$6/screen`, monthly billing, no contracts
- Final CTA: `Run every screen from one place.`

- [x] **Step 2: Point `/` at the component**

Replace the old `web/src/app/page.tsx` composition with `return <OperationalHomepage />`.

### Task 3: Landing-Only Visual System

- [x] **Step 1: Add `vh-*` CSS utilities**

Add landing-only helpers for:
- light page background
- restrained section reveal
- card hover elevation
- screen/mockup visual surfaces
- blue primary button
- deployment visual treatment

- [x] **Step 2: Avoid shared token churn**

Do not alter `:root`, `.dark`, dashboard layout classes, or existing dashboard components.

### Task 4: Metadata

- [x] **Step 1: Update direct positioning metadata**

Change title/description away from AI-run-itself language toward simple professional digital signage for growing businesses.

### Task 5: Verification

- [x] **Step 1: Run focused homepage test**

Run: `pnpm --filter @vizora/web test -- --runTestsByPath src/app/__tests__/homepage.test.tsx`

Expected: PASS.

- [x] **Step 2: Run web build**

Run: `pnpm --filter @vizora/web build`

Result: BLOCKED by existing Google font TLS fetch failures and Tailwind config module resolution for `./src/theme/colors` / `./src/theme/tokens`.

- [x] **Step 3: Browser screenshots**

Start the web dev server on port 3001 and capture desktop and mobile screenshots of `/`. Check:
- no dark/neon/AI visual direction
- hero fits above fold with dashboard visible
- no text overlap
- pricing and final CTA visible after scroll
- mobile nav and hero do not overflow

### Self-Review

- Spec coverage: The plan covers the approved homepage-only scope and all eight requested homepage sections.
- Placeholder scan: No placeholders remain; implementation details are bounded to explicit files and copy.
- Scope check: Shared marketing tokens are intentionally deferred until visual review.
