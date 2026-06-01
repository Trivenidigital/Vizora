# Playlist List Payload Performance Pass 17

Date: 2026-06-01
Branch: `feat/playlist-list-payload-pass-17`

## Drift Check

- `middleware/src/modules/playlists/playlists.service.ts` already has separate `findAll` and `findOne` paths.
- `findAll` currently loads every playlist item with `content: true`, so the paginated list endpoint returns the full content row for each item.
- `findOne`, create/update, display-push, and item mutation paths still need richer playlist payloads and are out of scope for this pass.
- Dashboard list consumers use list item title/thumbnail/type/duration/file-size summary data:
  - `web/src/app/dashboard/playlists/page-client.tsx` renders thumbnails, first item labels, total duration, and total size.
  - `web/src/app/dashboard/devices/page-client.tsx` fetches playlists for bulk assignment and mostly needs ids/names.

## New Primitives Introduced

None.

## Hermes-First Analysis

This is not a business-agent, MCP, AI-provider, or Hermes runtime change. It is a local NestJS/Prisma response-shaping improvement on an existing API endpoint.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Playlist list payload shaping | Not applicable | Use existing NestJS service and Prisma query path |
| Customer dashboard performance | Not applicable | Keep within current `/api/v1/playlists` contract |

Awesome-Hermes-agent ecosystem check: not applicable because no agent skill or provider path is being introduced.

## Design

Use Vizora-native Prisma `select` on the nested `items.content` relation in `PlaylistsService.findAll`.

Keep returned list semantics needed by existing clients:
- playlist top-level fields remain unchanged
- `items` remains present and ordered
- item fields remain present: `id`, `playlistId`, `contentId`, `order`, `duration`
- `content.title` and `content.thumbnailUrl` are still mapped from `name` and `thumbnail`
- `totalDuration`, `totalSize`, and `itemCount` remain computed

Only remove heavy content fields from the list query: raw URLs/storage keys, metadata, template/html payloads, processing fields, and other detail-only columns. `findOne` remains the full detail endpoint.

## Test Plan

1. Add a red unit test proving `findAll` uses a nested content projection instead of `content: true`.
2. Verify the mapped response still contains `title`, `thumbnailUrl`, `type`, duration, file size totals, and item counts.
3. Run focused playlist service/controller tests.
4. Run middleware typecheck, changed-file lint, full middleware test suite, build, and diff check.
5. Dispatch multiple reviewers before broader tests and resolve any high/medium findings.

## Deployment

No direct deployment in this pass unless the production checkout is first reconciled. Current production state remains dirty/diverged and deployment-blocked.
