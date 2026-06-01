# Content List Payload Performance Pass 19

Date: 2026-06-01
Branch: `feat/content-list-payload-pass-19`

## Why Now

The content dashboard now uses server-side pagination and filtering, but the
root and folder list endpoints still fetch and return full `Content` rows. For
real customer libraries this means every list page can carry modal-only fields
such as full media URLs and large `metadata` JSON blobs containing template HTML
or rendered widget payloads.

## New primitives introduced

No new runtime primitives. This pass adds a shared content-list projection and
uses the existing `GET /content/:id` detail endpoint for modal-only hydration.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Current Runtime/Code Evidence

- `ContentService.findAll` uses `content.findMany(... include: { tags })` and
  maps full rows into the list response.
- `FoldersService.getContents` does the same for folder-scoped content lists.
- `ContentClient` renders list/grid cards from `title`, `type`, `status`,
  `thumbnailUrl`, `duration`, and `createdAt`.
- `PreviewModal`, edit URL fields, and flagged-review reason display need full
  detail fields and can use the existing `apiClient.getContentItem(id)` path.

## Plan

- Add backend tests proving root and folder content lists use a bounded
  projection that excludes modal-only `url`, `metadata`, `mimeType`, and
  playlist relations.
- Implement a shared list select in the middleware content service and reuse it
  from folder content lists.
- Add dashboard tests proving initial list render does not need `url` or
  `metadata`, and preview/edit/review actions hydrate full content through
  `getContentItem`.
- Implement a small detail-loading helper in the content dashboard that preserves
  the selected summary immediately and opens the modal after detail fetch
  succeeds.
- Run focused middleware/web tests, subagent code review, broader affected
  verification, PR/CI/merge, then re-check the production deploy gate.

## Risks

- Removing fields from list responses can break hidden dashboard assumptions.
  Mitigation: tests cover summary-only list render and modal hydration paths.
- Folder content responses should match root list shape. Mitigation: both
  services use the same select constant.
- Production deploy remains gated by the dirty/diverged prod checkout; no deploy
  should occur until that is classified or repaired by an operator-safe process.
