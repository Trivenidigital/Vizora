# Template Publish Tenant Guardrail Pass 33

## Scope

Close the residual tenant boundary gap in template publishing: an organization
must only publish global templates or its own non-global templates, and template
usage metadata must not be mutated for another organization's private template.

## New primitives introduced

None. This pass only tightens the existing `TemplateLibraryService` query
boundaries and adds focused regression coverage. It adds no schema, route,
module, response shape, realtime path, notification path, MCP tool, Hermes
skill, provider spend path, or production process.

## Hermes-first analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Drift Check

Existing template reads already use the intended global-or-own rule:

- `TemplateLibraryService.findOne()` scopes templates to global or caller org.
- `TemplateLibraryService.saveUserTemplate()` scopes non-global template edits
  to the caller org.

The residual gap is isolated to `TemplateLibraryService.publishTemplate()`,
which still fetches by template id and type only, then increments metadata by id.

## Implementation Plan

1. Add focused service tests proving cross-org private templates are treated as
   not found and do not create content or mutate metadata.
2. Keep global-template publishing and own private-template publishing working.
3. Move source-template verification into the transaction using the same
   global-or-own predicate.
4. Update use-count writes with the same scoped predicate.
5. Run focused template-library tests, reviewer gate, broader middleware tests,
   type check, lint, security scan, and build.

## Deployment

No deployment by default. Re-check the production checkout first; deployment
remains blocked if `/opt/vizora/app` is dirty or diverged.
