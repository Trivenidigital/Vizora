# Content MinIO Tenant Boundary Pass 40

**Branch:** `feat/customer-performance-readiness`

**Why now:** Multi-vector review found a high-severity tenant-boundary drift:
device content streaming verifies MinIO object keys are under the device org,
but dashboard download and delete paths can operate on any `minio://` object key
persisted on an org-owned content row.

**New primitives introduced:** one storage-module MinIO ownership helper. No
schema, env var, runtime process, realtime substrate, notification path, MCP
tool, Hermes skill, provider spend path, or parallel storage path.

**Hermes-first analysis:** not applicable. This is a storage tenant-boundary
hardening pass inside existing NestJS content/storage services, not a business
agent, MCP, Hermes, AI/provider, or spend-path change.

## Root Cause

Upload-generated MinIO keys are tenant-prefixed by
`StorageService.generateObjectKey()`, and `DeviceContentController` already
rejects keys outside `${organizationId}/`. Other content paths independently
extract `minio://` object keys without applying that same org-prefix guard.
This creates a trust-boundary mismatch whenever a polluted content row contains
`minio://other-org/...`.

## Plan

- [x] Add failing tests for foreign MinIO keys on dashboard download, thumbnail
  object reads, create/update persistence, single delete, and bulk delete.
- [x] Add a shared storage helper that extracts a MinIO object key only when it
  is owned by the current organization.
- [x] Use the helper in content create/update persistence, download URL
  generation, manual thumbnail object reads, single delete, and bulk delete.
- [x] Keep upload/replacement paths working because their generated keys already
  include the organization prefix.
- [x] Allow simple replacement to repair legacy polluted rows without deleting
  the foreign old object; keep backup replacement fail-closed for those rows.
- [x] Use the cleanup-safe helper in organization deletion and sole-admin
  account deletion so teardown does not delete foreign content objects or
  thumbnails from polluted rows.
- [x] Run focused middleware content tests, broader middleware tests/build, and
  security scan.
- [x] Run subagent review before PR/merge.

## Expected Behavior

- `minio://org-123/...` remains valid for org `org-123`.
- `minio://other-org/...` cannot be persisted through content service
  create/update as either `url` or `thumbnail`.
- Dashboard download does not presign foreign object keys.
- Delete paths do not call storage deletion for foreign object keys.
- Bulk delete reports the polluted row as failed while allowing safe rows to
  proceed.
- Simple replacement can move a polluted row to a current organization-owned
  object key without touching the foreign old object.
- Backup replacement rejects polluted old MinIO rows because archiving the
  previous URL would preserve the tenant-boundary violation.
- Replacement clears polluted existing MinIO thumbnails instead of preserving
  them on the active or archived content row.
- Organization/account teardown deletes only canonical `minio://` objects under
  the current org prefix and skips foreign or non-canonical persisted URLs.
