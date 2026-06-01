# Content Library Search Performance Pass 18

Date: 2026-06-01
Branch: `feat/content-library-search-pass-18`

## Drift Check

- The main content dashboard already uses server-side pagination, type/status/date/tag filters, and `search` via `apiClient.getContent(params)`.
- The middleware content list API already accepts bounded `search` and applies it with organization scope in `buildContentListWhere`.
- The playlist-builder `ContentLibraryPanel` still fetches one page and then filters `content` locally, so searching can miss matches on later pages and encourages operators to page through larger content libraries.
- No new backend primitive is needed.

## New Primitives Introduced

None.

## Hermes-First Analysis

This is not an agent, MCP, AI-provider, or Hermes runtime change. It is a UI consumer improvement using the existing content list API.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Content-library search | Not applicable | Use existing `/api/v1/content?search=` API |
| Playlist-builder performance | Not applicable | Keep within current React component and API client |

Awesome-Hermes-agent ecosystem check: not applicable because no agent skill or provider path is being introduced.

## Design

Update `ContentLibraryPanel` to:
- debounce the search input using the existing `useDebounce` hook
- include non-empty search terms in `apiClient.getContent({ page, limit, type, search })`
- reset pagination to page 1 when the search or type filter changes
- render the server response directly instead of filtering only the current page in memory

This preserves the existing API, pagination controls, draggable item behavior, and type filtering.

## Test Plan

1. Add a red component test proving search is sent to `getContent` rather than filtering only the current page.
2. Add or update coverage proving changing search/type resets to page 1.
3. Run focused `PlaylistBuilder` tests.
4. Run web typecheck/build and relevant broader web tests.
5. Dispatch multiple reviewers before broader tests.

## Deployment

No direct deployment in this pass unless the production checkout is reconciled. Current production remains dirty/diverged and deployment-blocked.
