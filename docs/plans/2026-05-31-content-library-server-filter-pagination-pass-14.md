# Content Library Server Filtering and Pagination - Pass 14

Date: 2026-05-31
Branch: `feat/customer-performance-pass-14`

## Why Now

The dashboard content library still loads every content row through
`fetchAllPaginated` and filters in the browser. That is tolerable for demo data,
but it becomes slow and failure-prone for a customer with hundreds or thousands
of uploads. The pagination helper already has a 10-page safety cap, so large
libraries can also fail instead of degrading gracefully.

This pass replaces the all-row dashboard path with server-side search/filter
queries and bounded page navigation while preserving the existing content
CRUD/upload/modals.

## New Primitives Introduced

Small extensions to existing primitives only:

- `ContentQueryDto` adds bounded `search`, `dateRange`, and `tagNames` query
  parameters.
- Existing content and folder-content list services apply those parameters in
  tenant-scoped Prisma `where` clauses.
- The existing dashboard content page tracks one paginated result page at a
  time.
- A content folder-list composite index backs `GET /folders/:id/content`.

## Hermes-First Analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, sidecar runtimes, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Dashboard content listing performance | none applicable | Build in existing dashboard/API substrate. |
| Content search/filter query handling | none applicable | Build in existing NestJS + Prisma services. |

Awesome-Hermes ecosystem check: not applicable because no agent capability or
LLM workflow is being introduced.

## Drift Check

Current repo evidence:

- `web/src/app/dashboard/content/page-client.tsx` calls `fetchAllPaginated` for
  root and folder content, then filters `content.filter(...)` in the client.
- `middleware/src/modules/content/content.service.ts` already has tenant-scoped
  paginated queries and type/status/template-orientation filters.
- `middleware/src/modules/folders/folders.service.ts` has a separate
  tenant-scoped folder-content query with pagination only.
- `packages/database/prisma/schema.prisma` already indexes
  `(organizationId, createdAt)`, `(organizationId, status, createdAt)`, and
  `(organizationId, type, createdAt)`, so simple server filters are aligned
  with the schema. Folder-scoped listing still needs a matching composite
  index for `(organizationId, folderId, createdAt)`.

## Selected Fix Bundle

- Add backend query support for content search, date range, and tag-name filters
  on both root content and folder content.
- Update the web API client types for the new list parameters.
- Change the dashboard content page to fetch one page of results at a time
  using server-side search/type/status/date/tag parameters.
- Add page navigation and total-count copy so customers can see bounded result
  sets instead of waiting for all rows.
- Add a folder-content composite index to support newest-first folder browsing.
- Keep existing modal lazy-load behavior for push/add-to-playlist unchanged.

## Acceptance Criteria

- Initial content-library load requests a single bounded page, not every page.
- Search/type/status/date/tag changes reset to page 1 and send query parameters
  to the API.
- Folder content uses the same bounded query behavior.
- Page navigation requests the next/previous page without losing tenant guards.
- Backend filters never remove `organizationId` from the Prisma `where` clause.
- Existing upload, delete, move-to-folder, push, preview, and playlist flows
  continue to work.

## Verification Plan

- Middleware unit tests for `ContentQueryDto`, `ContentService.findAll`, and
  `FoldersService.getContents`.
- Web unit tests for initial bounded fetch, server-filter query params, folder
  query params, and pagination controls.
- Type checks for middleware and web.
- Focused web/middleware Jest suites, then broader affected tests/builds.
- Multi-subagent code review before running the broader verification suite.

## Deployment

No production deployment from this pass until `/opt/vizora/app` dirty/diverged
state is classified and preserved. Repo-side merge can proceed after tests, CI,
and review are green.
