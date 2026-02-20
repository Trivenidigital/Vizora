Note: The homepage and dashboard UI were recently redesigned. The codebase has new design tokens, updated components, and restructured layouts. Do NOT revert or modify any UI/UX changes — your job is purely performance optimization on top of the current codebase as-is.

---

I need to improve the performance of the Vizora web application. The app feels sluggish — for example, uploading content takes 20-30 seconds with a spinner, and I suspect similar performance issues exist across other areas (page loads, API responses, rendering, navigation).

## Tools Available
- **Performance Optimization Skill** — Located at `.claude/skills/performance/SKILL.md`. Read this FIRST before doing anything. Follow its profiling-first approach, optimization patterns, and performance budgets for ALL decisions.
- **frontend-design@claude-code-plugins** — Reference for render optimization and component efficiency patterns. Already installed.
- **Claude Chrome extension (MCP)** — Use this to interact with the live dashboard at vizora.cloud, run Lighthouse audits, inspect Network tab timings, check Console for errors, and profile performance in real-time.

## Pre-Requisite Check
Before starting, verify the performance skill file exists:
```bash
cat .claude/skills/performance/SKILL.md
```
If it doesn't exist, STOP and tell me — I need to add it first.

This is a TWO-PHASE project. Do NOT start fixing anything until Phase 1 is complete and I've reviewed the plan.

---

## PHASE 1: Full Performance Audit & Optimization Plan

### Step 1: Read the Performance Skill

Read `.claude/skills/performance/SKILL.md` completely. Internalize:
- The "Measure First, Optimize Second" philosophy
- Profiling tools and techniques for frontend, backend, and database
- The specific performance budget targets
- The optimization patterns and code examples

### Step 2: Codebase Architecture Analysis

Examine the project to understand the full stack:

**Frontend:**
- Framework (React, Next.js, Vue, etc.) and version
- Build tool (Webpack, Vite, etc.) and current config
- Bundle size — run the appropriate bundle analyzer (`npx webpack-bundle-analyzer` or `npx vite-bundle-visualizer`)
- List ALL dependencies in package.json — flag any over 50KB
- CSS approach (Tailwind, CSS modules, styled-components) and total CSS size
- Image/asset handling — formats, sizes, loading strategy
- Code splitting — is route-based splitting implemented?
- Lazy loading — which components use `React.lazy()`? Which should but don't?
- State management — what library? Are there global state updates causing unnecessary re-renders?
- API call patterns — map every API call per page. Are there waterfalls? Redundant calls? Calls that could be batched or cached?

**Backend:**
- Framework (Express, NestJS, FastAPI, etc.)
- Database (PostgreSQL, MongoDB, etc.) and ORM
- File upload pipeline — trace the ENTIRE flow from multipart receive → validation → processing → storage → DB write → response. Time each stage.
- List ALL middleware in the chain — what runs on every request?
- WebSocket implementation and efficiency
- Caching strategy — is Redis or any cache layer configured? What's cached? What should be?
- Authentication — how heavy is the auth middleware? Does it hit the DB every request?

**Infrastructure:**
- Hosting environment (Vercel, AWS, VPS, etc.)
- CDN — is one configured for static assets?
- Database connection pooling — is it configured? What pool size?
- File storage — local disk, S3, or cloud storage?
- Compression — is gzip/brotli enabled on the server?
- Environment — any obvious misconfigurations (e.g., running in dev mode in production)?

### Step 3: Live Performance Profiling

Use the Chrome extension to profile the live app:

**Page-by-page metrics (Overview, Devices, Content, Templates, Widgets, Layouts, Playlists, Schedules, Analytics, Settings):**

For EACH page, document:
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Total number of network requests on load
- Total data transferred (KB/MB)
- Total JavaScript execution time
- Number of DOM elements
- Console errors or warnings
- Slowest network request and its time

**Lighthouse audits on:**
- Homepage (`vizora.cloud`)
- Dashboard Overview page
- Content page (known slow page)
- Any other page that feels slow during manual testing

Record all four Lighthouse scores: Performance, Accessibility, Best Practices, SEO.

**Deep dive investigations:**

1. **Content Upload (KNOWN ISSUE — 20-30 second spinner):**
   - Trace the COMPLETE pipeline with timing at each stage:
     - Frontend: file selected → validation → FormData created → request sent (time: ?)
     - Network: request in flight (time: ?)
     - Backend: request received → file parsed → validation (MIME check, size check) (time: ?)
     - Backend: file processing (thumbnail generation? compression? format conversion?) (time: ?)
     - Backend: file written to storage (time: ?)
     - Backend: database record created (time: ?)
     - Backend: response sent (time: ?)
     - Frontend: response received → UI updated (time: ?)
   - Is the upload a single request or chunked?
   - Is there any progress feedback or just a blind spinner?
   - What is the max file size? What happens at the limit?
   - Is thumbnail/preview generation happening synchronously during the request?

2. **API Response Times:**
   - Use `curl -w` timing format from the skill file on EVERY API endpoint
   - Create a table: endpoint, method, avg response time, status
   - Flag any endpoint > 300ms for reads or > 1000ms for writes
   - For slow endpoints, trace into the backend code to find why

3. **Database Performance:**
   - Identify the 10 most frequently executed queries
   - Run EXPLAIN ANALYZE on each
   - Check for sequential scans on large tables (missing indexes)
   - Check for N+1 query patterns in the ORM layer
   - Check connection pool settings

4. **Frontend Rendering:**
   - Identify components that re-render on every state change
   - Check if lists with 50+ items are virtualized
   - Check if heavy components (charts, editors, file uploaders) are lazy loaded
   - Check for layout thrashing (DOM reads/writes interleaved)
   - Check for memory leaks (growing DOM node count, detached event listeners)

5. **WebSocket Performance (if applicable):**
   - Connection establishment time
   - Message payload sizes
   - Reconnection behavior
   - Are unnecessary messages being sent?

### Step 4: Create the Performance Optimization Plan

Create `performance-optimization-plan.md` with:

#### A: Performance Baseline Dashboard

A clear table showing current state vs targets (from the skill's performance budgets):

```
| Metric              | Current    | Target     | Status |
|---------------------|------------|------------|--------|
| Homepage LCP        | ?          | < 2.5s     | ?      |
| Dashboard LCP       | ?          | < 2.5s     | ?      |
| Content Page LCP    | ?          | < 2.5s     | ?      |
| JS Bundle (gzip)    | ?          | < 200KB    | ?      |
| Content Upload      | 20-30s     | < 5s       | FAIL   |
| Avg API Read        | ?          | < 200ms    | ?      |
| Avg API Write       | ?          | < 500ms    | ?      |
| Lighthouse Perf     | ?          | > 90       | ?      |
```

#### B: Content Upload Root Cause Analysis
- Time breakdown by pipeline stage (with actual measurements)
- The specific bottleneck(s) identified
- Proposed fix for each bottleneck
- Expected time after fix

#### C: Critical Issues (fix in Batch 1)
Issues with highest user-facing impact:
- Problem description
- Current metric → Target metric
- Root cause (with specific file paths and line numbers)
- Proposed fix (specific code changes)
- Expected improvement

#### D: Frontend Optimizations
Ordered by impact (highest first):

**Bundle Size:**
- List every dependency > 20KB with size
- Which can be tree-shaken, replaced, or removed?
- Where should code splitting be added?
- Which components need lazy loading?

**Render Performance:**
- Which components re-render unnecessarily? (list them)
- Which lists need virtualization? (list them with item counts)
- Where is memoization needed?

**Network:**
- API call waterfalls (page loads that make sequential dependent calls)
- Redundant calls (same data fetched multiple times)
- Missing client-side caching
- Prefetching opportunities

**Assets:**
- Images not in WebP/AVIF format
- Images without lazy loading
- Missing width/height causing CLS
- Assets without cache headers

#### E: Backend Optimizations
Ordered by impact (highest first):

**Slow Endpoints:**
- Table of all endpoints with response times
- For each slow endpoint: root cause and fix

**Database:**
- Missing indexes (with CREATE INDEX statements)
- N+1 queries (with eager loading fixes)
- Unoptimized queries (with rewritten versions)
- Connection pool recommendations

**Upload Pipeline:**
- Specific changes to reduce upload time
- Background job architecture for heavy processing
- Chunked upload implementation plan

**Caching:**
- What to cache (with TTL recommendations)
- Cache invalidation strategy
- Redis vs in-memory decision

**Middleware:**
- Middleware that runs unnecessarily on hot paths
- Auth optimization (token caching, reducing DB hits)

#### F: Infrastructure Optimizations
- Compression configuration
- CDN setup for static assets
- Cache-control header strategy
- Database connection pool tuning
- Production mode verification

#### G: Implementation Batches (with dependencies)
```
Batch 1: Content upload fix + top 3 slowest API endpoints
         (biggest user pain — do first, no dependencies)
         
Batch 2: Database optimization (indexes, N+1 fixes, connection pool)
         (enables Batch 4 backend improvements)
         
Batch 3: Frontend bundle optimization (code splitting, lazy loading, tree shaking)
         (independent — can run parallel with Batch 2)
         
Batch 4: Backend caching + middleware optimization
         (depends on Batch 2 database fixes being in place)
         
Batch 5: Render optimization (memoization, virtualization, re-render fixes)
         (depends on Batch 3 component restructuring)
         
Batch 6: Infrastructure + final polish (CDN, compression, prefetching, headers)
         (run last — final layer on top of everything)
```

**STOP HERE. Output the plan and wait for my review before proceeding to Phase 2.**

---

## PHASE 2: Implementation (Begin ONLY after I approve Phase 1)

### Agent Team Setup

**Agent 1 — Content Upload Fix (HIGHEST PRIORITY — start immediately)**
- This is the #1 user-facing pain point
- Trace the upload pipeline and fix each bottleneck:
  - Add client-side validation BEFORE upload starts (file type, size) — fail fast
  - Implement chunked uploads if not already done
  - Replace the blind spinner with a real progress bar showing percentage and stage
  - Move heavy backend processing (thumbnails, format conversion, virus scan) to background jobs
  - Return the API response as soon as the file is stored — don't wait for processing
  - Optimize the storage write path
- Target: < 5 seconds for a 10MB file with visible progress at every stage
- MEASURE: Log time at each pipeline stage before AND after changes
- Test via Chrome extension: upload multiple file types and sizes

**Agent 2 — Backend & Database Performance**
- Add ALL missing database indexes identified in the audit
- Fix ALL N+1 query patterns (convert to eager loading / JOINs)
- Rewrite the top 5 slowest queries
- Implement response caching for frequently accessed, rarely changed data
- Optimize authentication middleware (cache token validation, reduce DB lookups)
- Remove or conditionally skip unnecessary middleware on read-heavy routes
- Configure database connection pooling properly
- Ensure ALL list endpoints use pagination with sensible defaults
- Target: All reads < 200ms, all writes < 500ms
- MEASURE: curl every changed endpoint before AND after with timing

**Agent 3 — Frontend Bundle Optimization**
- Run bundle analyzer and document the top 10 largest modules
- Implement route-based code splitting: each dashboard page should be a lazy-loaded chunk
- Lazy load ALL heavy components: charts, rich text editors, file uploaders, modals with complex content
- Tree shake aggressively — remove unused exports
- Replace heavy libraries with lighter alternatives (e.g., lodash → lodash-es or individual imports, moment → date-fns)
- Optimize Tailwind CSS purging (if using Tailwind) — remove unused classes
- Set proper cache-control headers: immutable for hashed assets, short TTL for HTML
- Target: Total JS < 200KB gzipped, total CSS < 50KB gzipped
- MEASURE: Record bundle sizes before AND after each change

**Agent 4 — Render Performance**
- Profile React components — identify the top 10 most frequently re-rendering components
- Add React.memo to pure presentational components that re-render with same props
- Add useMemo for expensive computations (filtering, sorting, data transformations)
- Add useCallback for event handlers passed as props
- Implement virtual scrolling (react-window or react-virtuoso) for:
  - Device list
  - Content library grid/list
  - Playlist items
  - Any list that could exceed 50 items
- Add skeleton loading screens for every page (perceived performance improvement)
- Fix any layout thrashing patterns
- Optimize state management to prevent cascade re-renders
- Target: Smooth 60fps on all interactions, no frame drops > 50ms
- MEASURE: Chrome DevTools Performance recording before AND after

**Agent 5 — Infrastructure & Final Verification**
- Enable gzip/brotli compression on the server (if not already)
- Configure CDN for all static assets (JS, CSS, images, fonts)
- Set optimal cache-control headers across all resource types
- Implement `<link rel="prefetch">` for likely next navigations
- Verify the app is running in production mode (not dev mode)
- Optimize WebSocket connections (if applicable)
- Run FINAL Lighthouse audit on ALL pages
- Run FINAL curl timing test on ALL API endpoints
- Run FINAL content upload test
- Target: Lighthouse Performance > 90 on every page

### Hard Rules
- Follow `.claude/skills/performance/SKILL.md` patterns for EVERY decision
- MEASURE before and after EVERY single change — no exceptions
- If a change doesn't measurably improve performance, REVERT it immediately
- Do NOT change any UI design, layout, colors, or visual elements — the recent redesign must stay intact
- Do NOT change any business logic or functionality
- Do NOT break any existing features — test after every change
- Test via Chrome extension after every batch
- Keep a running log of all changes and their measured impact

### Final Verification Checklist
After all agents complete:

1. **Lighthouse re-audit:** Run on Homepage, Dashboard, Content, Templates, Analytics
2. **Upload test:** Upload a 10MB image — confirm < 5 seconds with progress bar
3. **API timing test:** curl all endpoints — confirm within performance budgets
4. **Navigation test:** Click through every page — confirm smooth, instant transitions
5. **Functionality test:** Verify core flows still work (login, upload, pair, push, playlist)
6. **No visual regressions:** Confirm the UI redesign is completely untouched

7. **Create `performance-optimization-results.md`** with:

```
## Results Summary

### Before vs After — Page Load Times
| Page        | LCP Before | LCP After | Improvement |
|-------------|-----------|-----------|-------------|
| Homepage    |           |           |             |
| Dashboard   |           |           |             |
| Content     |           |           |             |
| ...         |           |           |             |

### Before vs After — Content Upload
| Stage              | Before   | After    | Improvement |
|--------------------|----------|----------|-------------|
| Client validation  |          |          |             |
| Network transfer   |          |          |             |
| Server processing  |          |          |             |
| Storage write      |          |          |             |
| DB write           |          |          |             |
| Total              | ~25s     |          |             |

### Before vs After — Bundle Size
| Asset       | Before (gzip) | After (gzip) | Reduction |
|-------------|--------------|--------------|-----------|
| Total JS    |              |              |           |
| Total CSS   |              |              |           |
| Largest chunk|             |              |           |

### Before vs After — API Response Times
| Endpoint           | Before  | After   | Improvement |
|--------------------|---------|---------|-------------|
| GET /api/devices   |         |         |             |
| GET /api/content   |         |         |             |
| POST /api/upload   |         |         |             |
| ...                |         |         |             |

### Before vs After — Lighthouse Scores
| Page        | Perf Before | Perf After | Delta |
|-------------|------------|------------|-------|
| Homepage    |            |            |       |
| Dashboard   |            |            |       |
| Content     |            |            |       |

### Changes Made (ordered by impact)
1. ...
2. ...

### Remaining Issues & Recommendations
- ...
```

---

Start Phase 1 now. Read the Performance Skill file first, then analyze the codebase architecture, then begin live profiling with the Chrome extension.
