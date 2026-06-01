# Template Action Truthfulness Pass 36

## Goal

Make the template dashboard show only actions a customer admin can complete, and
make the AI Designer entry points honest while the backend feature remains
disabled.

## New primitives introduced

None. This pass only aligns existing frontend affordances with existing backend
guards and the existing `ai-generate` unavailable response. No route, module,
schema, middleware, response envelope, realtime path, notification path, MCP
tool, Hermes skill, provider spend path, env var, or production process changes.

## Hermes-first analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Drift check

- `middleware/src/modules/template-library/template-library.controller.ts`
  protects create/update/delete with `SuperAdminGuard`.
- `middleware/src/modules/template-library/template-library.service.ts`
  returns `{ available: false }` from AI generation.
- The dashboard currently keys several authoring actions off `role === 'admin'`
  and the AI modal simulates generation before showing the disabled response.

## Plan

- [x] Extend frontend auth user shape to preserve optional `isSuperAdmin`.
- [x] Gate template library create/edit/delete actions on `isSuperAdmin === true`
  rather than org admin role.
- [x] Route customer customization through clone/publish flows instead of
  update-template-only editors.
- [x] Replace AI Designer generation simulation with an honest coming-soon modal
  and copy across hero/sidebar/mobile/empty states.
- [x] Add focused web tests for ordinary org admin behavior.
- [x] Run multi-vector review, focused tests, typecheck/lint/security, and web
  unit/build verification.
