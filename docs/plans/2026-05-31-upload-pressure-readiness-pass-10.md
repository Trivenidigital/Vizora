# Upload Pressure Readiness Pass 10 Plan

**Goal:** Reduce customer-visible upload pressure by removing 100MB media buffers from the middleware hot path where practical and by preventing dashboard bulk uploads from driving avoidable concurrent large-file pressure.

**Architecture:** Keep the work inside the existing content upload surfaces: NestJS `ContentController`, `FileValidationService`, `StorageService`, and the dashboard content page. Use Multer disk-backed temporary files for HTTP uploads, stream validation/hash/upload from disk, and preserve the current quota, MinIO, local-dev fallback, thumbnail, and response-envelope behavior.

**Tech Stack:** NestJS, Multer, Node streams, MinIO SDK, Next.js/React content dashboard, Jest.

---

## Scope

**New primitives introduced:** small helper methods only:

- `FileValidationService.validateFileAtPath(...)`
- `StorageService.uploadFileFromPath(...)`
- `ContentController` private helpers for uploaded-file validation, storage upload, local fallback, thumbnail scheduling, and temp cleanup.

**Hermes-first analysis:** not applicable to the selected implementation because this pass does not add business agents, MCP tools, Hermes skills, AI provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| HTTP upload buffering | none applicable | Build in existing middleware controller/storage path |
| File validation/hash streaming | none applicable | Build in existing validation service |
| Dashboard upload backpressure | none applicable | Build in existing content dashboard controls |

Awesome-Hermes ecosystem verdict: not applicable; these are first-party upload/runtime paths, not agent skills.

## Current Evidence

- `ContentController` uses `FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } })`, which defaults to memory-backed Multer storage and leaves uploaded bytes in `file.buffer`.
- `uploadFile` and `replaceFile` validate `file.buffer`, upload `file.buffer` to MinIO, write local fallback from `file.buffer`, and schedule image thumbnails from `file.buffer`.
- `StorageService.uploadFile` calls MinIO `putObject` with a `Buffer`.
- `FileValidationService.validateFile` computes magic-number checks, suspicious-content checks, and hash from a whole buffer.
- The dashboard content page currently permits several queued files and uses a fixed concurrency of 3.

## Selected Fix Bundle

1. Switch content upload and replace-file interceptors to disk-backed temporary storage while preserving the 100MB HTTP limit.
2. Add file-path validation that checks allowed MIME/extension/size, reads the magic/signature window for all files, scans full PDFs for active-content markers, scans the first suspicious-content window for other media, and hashes via a stream.
3. Add MinIO upload-from-path using a read stream and known size, preserving the existing circuit breaker and metadata behavior.
4. Keep unit-test direct controller calls working for buffer-backed mock files.
5. Clean temporary upload files on success and failure, including image thumbnail background work.
6. Add dashboard upload pressure guards: per-type max-size copy enforced by dropzone, a bounded queue, and dynamic concurrency that uploads videos/PDFs one at a time.

## Deferred Follow-Ups

- True multipart/chunked resumable uploads with server-side session state.
- Background thumbnail queue instead of in-process fire-and-forget work.
- Server-backed content-library pagination/search and thumbnail virtualization.
- Shared dashboard realtime socket provider.

## Verification Plan

Focused red/green tests:

- `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="file-validation.service|storage.service|content.controller"`
- `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="dashboard/content"`

Broader checks after subagent review:

- `pnpm --filter @vizora/middleware test -- --runInBand`
- `pnpm --filter @vizora/web test -- --runInBand`
- `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
- `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
- `npx nx build @vizora/middleware`
- `$env:NEXT_PUBLIC_SOCKET_URL='http://localhost:3002'; $env:NEXT_PUBLIC_API_URL='http://localhost:3000'; $env:BACKEND_URL='http://localhost:3000'; $env:NODE_OPTIONS='--max-old-space-size=4096'; npx nx build @vizora/web`
- `git diff --check`

Deployment remains blocked unless the production checkout is reconciled and safe after merge.
