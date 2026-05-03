# Vizora MCP Server — Design Sketch

**Status:** Design-only. No code. Written 2026-05-03.
**Branch:** `docs/business-agents-discipline`
**Companion docs:** `docs/agents-architecture.md` (the discipline this enables)

---

## Why

Vizora has 20 agents today. Each one that needs Vizora data writes its own glue code: HTTP client, auth, retry, schema. That's reinvention per agent.

**A Vizora MCP server inverts that.** One stable tool surface. Any agent — internal Vizora ops, Claude Code subagents, external Hermes business-agents (the future `vizora-business-agents/` repo per `docs/agents-architecture.md`), eventually customer-built integrations — uses the same tools by name.

It's the same pattern shift-agent uses with `qbo_client.py` for QuickBooks: one client, many callers, one upgrade point. Except MCP makes it standard-protocol instead of bespoke client.

---

## Scope

### In scope (v1)

**Read-only tools.** The agent ecosystem is currently mostly observational (triage, lifecycle, content recommendations). Read tools cover 80% of agent demand and carry zero blast-radius risk.

| Tool | Purpose |
|---|---|
| `list_displays(org_id, status?, group?, limit?)` | Fleet snapshot |
| `get_display(display_id)` | Per-device deep view |
| `get_display_health(display_id)` | Heartbeat status, last-seen, online/offline transitions |
| `list_content(org_id, type?, folder?, limit?)` | Content library |
| `get_content(content_id)` | Per-asset view |
| `list_playlists(org_id, limit?)` | Playlists |
| `get_playlist(playlist_id)` | Per-playlist view (items + ordering) |
| `list_schedules(org_id, active_only?, limit?)` | Schedules |
| `get_schedule(schedule_id)` | Per-schedule view |
| `list_organizations(limit?)` | Orgs (admin scope) |
| `get_org_health(org_id)` | Aggregate org health: display online rate, storage usage, billing status |
| `list_recent_incidents(org_id, since?)` | Reads from `logs/ops-state.json` — last N ops incidents for this org |
| `get_audit_trail(resource_type, resource_id, limit?)` | Decision audit log entries for a resource |

### Out of scope (v1)

- **Write tools.** Any tool that mutates state stays out of v1. When agents need to act, they go through existing middleware endpoints (with their existing auth + audit), not through MCP. Reason: MCP write-tools amplify blast radius (one auth lapse → mass mutation). Read-first earns trust before write.
- **Per-customer config tools.** v1 is for Vizora's internal agents. Customer-facing MCP is a v2 concern.
- **LLM-mediated routing.** The MCP server is a tool surface, not a router.

---

## Module layout (NestJS)

```
middleware/src/modules/mcp/
├── mcp.module.ts                    ← NestJS module wiring
├── mcp.controller.ts                ← exposes /api/v1/mcp endpoint(s) for transport
├── mcp.service.ts                   ← MCP server lifecycle, tool registration
├── transports/
│   ├── http.transport.ts            ← HTTP/SSE transport (preferred for production)
│   └── stdio.transport.ts           ← stdio for local dev / CI testing
├── auth/
│   ├── mcp-auth.guard.ts            ← validates MCP-specific tokens (not user JWTs — see Auth section)
│   └── mcp-token.service.ts         ← issue/revoke MCP tokens, scope enforcement
├── tools/
│   ├── displays.tools.ts            ← list_displays, get_display, get_display_health
│   ├── content.tools.ts             ← list_content, get_content
│   ├── playlists.tools.ts           ← list_playlists, get_playlist
│   ├── schedules.tools.ts           ← list_schedules, get_schedule
│   ├── organizations.tools.ts       ← list_organizations, get_org_health
│   ├── audit.tools.ts               ← list_recent_incidents, get_audit_trail
│   └── tool-registry.ts             ← exports all tools as a Map<name, ToolDef>
├── schemas/
│   ├── tool-inputs.ts               ← Zod schemas for tool parameters
│   └── tool-outputs.ts              ← Zod schemas for tool return shapes
├── lib/
│   ├── pagination.ts                ← shared cursor / limit / offset helpers
│   └── error-mapping.ts             ← maps NestJS exceptions → MCP error responses
└── tests/
    ├── auth.spec.ts
    ├── tools.spec.ts
    └── e2e/
        └── mcp.e2e-spec.ts
```

Tool implementations are thin: they call the existing NestJS services (`DisplaysService`, `ContentService`, etc.) and project the result into the Zod-defined output schema. **No new business logic in `mcp/`.**

---

## Auth model

### Why not reuse user JWTs

User JWTs are wide-scope (a user can do everything they're allowed to do across the whole app). MCP tokens should be narrow-scope (this token can only call these tools, for this org, until this date).

### MCP token shape

```ts
type McpToken = {
  tokenId: string;           // opaque ID for revocation lookup
  organizationId: string;    // scope: which org's data this token can read
  scope: string[];           // e.g., ['displays:read', 'content:read', 'audit:read']
  agentName: string;         // 'support-triage' | 'customer-lifecycle' | etc. — for audit attribution
  issuedAt: Date;
  expiresAt: Date;
  rotatedFrom?: string;      // previous tokenId if this is a rotation
};
```

Token storage: new Prisma table `McpToken` with index on `tokenId`. Token *value* is HMAC-signed; the database stores only the hash. Revocation = mark `revokedAt` on the row.

### Authentication flow

1. Agent presents `Authorization: Bearer <mcp-token>` to `/api/v1/mcp`
2. `McpAuthGuard` parses + verifies HMAC, looks up `tokenId`, checks `expiresAt > now` and `revokedAt is null`
3. On success, the token's `organizationId`, `scope`, and `agentName` flow into request context
4. Each tool checks its required scope against the request context's scope set
5. Every tool call writes an audit entry: `{ tokenId, agentName, tool, params (redacted), result_summary, latency_ms, ts }`

### Token lifecycle

- **Issuance:** admin-only endpoint `POST /api/v1/admin/mcp-tokens` — must specify `organizationId`, `scope`, `agentName`, `expiresAt` (max 90 days)
- **Rotation:** monthly cron reminder per shift-agent's security posture
- **Revocation:** admin endpoint or auto-revoke on suspicious activity (configurable threshold of `4xx` per minute)

---

## Tool definition pattern

Each tool is a function + a Zod input schema + a Zod output schema + a required scope:

```ts
// tools/displays.tools.ts
import { z } from 'zod';
import { ToolDef } from './tool-registry';

const ListDisplaysInput = z.object({
  status: z.enum(['online', 'offline', 'all']).optional().default('all'),
  group_id: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

const ListDisplaysOutput = z.object({
  displays: z.array(z.object({
    id: z.string(),
    name: z.string(),
    organization_id: z.string(),
    status: z.enum(['online', 'offline', 'unknown']),
    last_seen_at: z.string().datetime().nullable(),
    location: z.string().nullable(),
    current_playlist_id: z.string().nullable(),
  })),
  next_cursor: z.string().nullable(),
});

export const listDisplays: ToolDef<typeof ListDisplaysInput, typeof ListDisplaysOutput> = {
  name: 'list_displays',
  description: 'List displays for the current org. Read-only. Returns paginated results.',
  inputSchema: ListDisplaysInput,
  outputSchema: ListDisplaysOutput,
  requiredScope: 'displays:read',
  handler: async (input, ctx) => {
    // ctx.organizationId comes from the validated MCP token
    const result = await ctx.displaysService.findByOrg({
      orgId: ctx.organizationId,
      status: input.status === 'all' ? undefined : input.status,
      groupId: input.group_id,
      limit: input.limit,
      cursor: input.cursor,
    });
    return ListDisplaysOutput.parse({
      displays: result.items.map(toMcpShape),
      next_cursor: result.nextCursor,
    });
  },
};
```

`tool-registry.ts` collects all tools and exposes them via the MCP `tools/list` and `tools/call` endpoints.

---

## How a Hermes business-agent consumes it

In `vizora-business-agents/src/platform/vizora_mcp_client.py` (modeled after shift-agent's `qbo_client.py`):

```python
# Pseudo-code
class VizoraMcpClient:
    def __init__(self, base_url: str, token: str):
        self.session = httpx.Client(base_url=base_url, headers={"Authorization": f"Bearer {token}"})

    def list_displays(self, status=None, limit=20):
        return self._call_tool("list_displays", {"status": status, "limit": limit})

    def _call_tool(self, name, args):
        r = self.session.post("/api/v1/mcp/tools/call", json={"name": name, "arguments": args})
        r.raise_for_status()
        return r.json()["content"]
```

A SKILL.md in the Hermes side then references:

> *"Call `list_displays` with `status=offline` to find displays needing attention. The tool returns a JSON list with id, name, last_seen_at. Iterate and decide which ones to flag."*

The SKILL doesn't need to know the URL, the auth header shape, or the schema. It just calls a tool by name. **That's the whole point.**

---

## Wiring to existing NestJS services

| MCP tool | Calls into | Existing service file |
|---|---|---|
| `list_displays`, `get_display` | `DisplaysService` | `middleware/src/modules/displays/displays.service.ts` |
| `get_display_health` | `RedisService` (online status) + `DisplaysService` (persisted state) | both |
| `list_content`, `get_content` | `ContentService` | `middleware/src/modules/content/content.service.ts` |
| `list_playlists`, `get_playlist` | `PlaylistsService` | `middleware/src/modules/playlists/playlists.service.ts` |
| `list_schedules`, `get_schedule` | `SchedulesService` | `middleware/src/modules/schedules/schedules.service.ts` |
| `list_organizations`, `get_org_health` | `OrganizationsService` + new `OrgHealthAggregator` | new aggregator (small) |
| `list_recent_incidents` | New `OpsStateReader` that reads `logs/ops-state.json` | new (small) |
| `get_audit_trail` | New `AuditService` over the existing audit-log surface | new (medium) |

**No new business logic.** The MCP layer is a projection over what already exists.

---

## Read-only safety

The `requiredScope` enum is exhaustively `*:read`. There is no `*:write` scope in v1. The `mcp-auth.guard.ts` enforces this by rejecting any token issued with a write scope (until v2 introduces them).

This is a deliberate constraint, not an oversight. Earning the right to write happens after a measurement period (30+ days) of observed read traffic + zero auth incidents.

---

## Pagination

Cursor-based, base64-encoded opaque cursor. Same pattern as Vizora's existing `PaginationDto`. `lib/pagination.ts` wraps the existing helper so MCP tools use it consistently.

Max `limit` = 100 per call. Hard cap at the schema layer.

---

## Error model

MCP-spec-compliant error responses:

```json
{
  "error": {
    "code": "TOOL_NOT_FOUND" | "INVALID_INPUT" | "FORBIDDEN" | "INTERNAL" | "RATE_LIMITED",
    "message": "Human-readable description",
    "data": { "details": "..." }
  }
}
```

`error-mapping.ts` maps NestJS exceptions:
- `NotFoundException` → `INVALID_INPUT` (the resource doesn't exist for this org)
- `ForbiddenException` → `FORBIDDEN`
- `BadRequestException` → `INVALID_INPUT`
- Anything else → `INTERNAL` (with the exception logged but stack trace stripped from the response)

---

## Rate limiting

Per-token rate limit, distinct from the existing user/org rate limiters:
- 60 calls / minute / token (default)
- 1000 calls / day / token (default)
- Configurable per token at issuance time (admin override)

Triggers `RATE_LIMITED` error response with `Retry-After` header.

---

## Observability

| Metric | Why |
|---|---|
| `mcp_tool_calls_total{tool, agent, status}` | Per-tool / per-agent volume + success rate |
| `mcp_tool_latency_ms{tool, p50, p95, p99}` | Per-tool latency |
| `mcp_auth_failures_total{reason}` | Token validation failures by cause |
| `mcp_rate_limit_hits_total{token_id}` | Tokens hitting the rate limit |
| `mcp_active_tokens` | Currently-valid tokens count |

Add to existing Prometheus + Grafana setup (Vizora already has `vizora-overview.json` dashboard — add an `vizora-mcp.json` dashboard).

---

## Testing approach

| Layer | What |
|---|---|
| Unit | Each tool handler with mocked services. Verify Zod input/output validation, scope enforcement, error mapping. |
| Integration | NestJS test app with real Prisma (test DB), real services. Verify tool-call → service-call → DB-query → response shape. |
| E2E | Spin up the MCP server, issue a real token via admin endpoint, call every tool from a Python or Node MCP client, verify wire shape. |
| Auth | Forgery / expired / revoked / scope-mismatch — explicit tests for each rejection path. |
| Rate limit | Burst tests — verify limiter triggers + recovery + headers. |
| Audit | Verify every successful + failed tool call writes an audit row with `tokenId`, `agentName`, `tool`, `params (redacted)`, `latency_ms`. |

---

## Migration / rollout sequence

Following shift-agent's "infra-and-safety first, agent logic last" build order:

1. Schemas (`tool-inputs.ts`, `tool-outputs.ts`)
2. Auth (`mcp-auth.guard.ts`, `mcp-token.service.ts`, `McpToken` Prisma table + migration)
3. Admin endpoint to issue/revoke tokens
4. Audit + observability hooks (so when tools come online, they're already instrumented)
5. Rate limiter
6. One read tool end-to-end (`list_displays`) — exercises the full stack
7. Remaining read tools, one at a time
8. Hermes-side `vizora_mcp_client.py` (in `vizora-business-agents/` repo)
9. First Hermes business-agent migration: `support-triage` (the only live LLM-shaped business agent today)
10. Measurement period (30 days) — observed read traffic, zero auth incidents → green-light v2 (write tools)

---

## What this unlocks

| Today | After MCP server lands |
|---|---|
| Each new agent writes its own HTTP client + auth + retry | Each new agent imports `vizora_mcp_client` and calls tools by name |
| Per-agent permission management is ad hoc | Per-token scope + revocation is centralized |
| No agent-decision quality metric | `mcp_tool_calls_total` segmented by `agent` makes per-agent activity visible |
| Customer integrations need bespoke API contracts | A future v2 customer-facing MCP surface piggybacks on the same code |
| Hermes sidecar in Python is a 2-week integration project | Hermes sidecar is a thin client over a stable surface |

---

## What this does NOT do

- Doesn't replace the existing REST API. The Vizora dashboard, mobile app, and Electron client continue to use `/api/v1/*` directly. MCP is for agents.
- Doesn't add LLM capabilities to the middleware. The middleware exposes tools; LLMs live in the agent layer.
- Doesn't deprecate ops-* agents. Those are deterministic cron tasks; they don't benefit from MCP routing. They can keep calling internal services directly.
- Doesn't ship in the same PR as the homepage redesign or any other unrelated work. New module, dedicated branch, dedicated review.

---

## Estimated effort

| Phase | Effort | Dependencies |
|---|---|---|
| Schemas + auth + admin endpoint + Prisma migration | 1 dev-day | None |
| Audit + observability + rate limiter | 0.5 dev-day | Existing Prometheus / Grafana |
| First read tool (`list_displays`) end-to-end + tests | 0.5 dev-day | Phases above |
| Remaining 12 read tools | 2 dev-days | First tool establishes the pattern |
| `vizora_mcp_client.py` in `vizora-business-agents/` repo | 0.5 dev-day | MCP server reachable |
| First Hermes business-agent migration (`support-triage`) | 2 dev-days | shift-agent discipline applied |

**Total: ~6.5 dev-days for the full sequence.** Phases 1–4 (~4 days) deliver the standalone MCP server. Phases 5–6 are the first agent that uses it.

---

## Open questions

1. **Transport choice — HTTP/SSE vs stdio:** HTTP/SSE is the production answer (works across machines, integrates with existing nginx + TLS). stdio is useful for local dev. Both should ship in v1.
2. **Token storage in Prisma vs Redis:** Prisma for durability + admin queries; Redis for fast revocation lookup with Prisma as source of truth. Lookup pattern: check Redis, miss → Prisma → write-through to Redis.
3. **`list_recent_incidents` data source:** ops-state.json is local to the VPS; if the middleware runs on a different host eventually, this needs a different source. v1 assumes single-host (matches today).
4. **Audit log retention:** how long to keep MCP call audits? Suggested: 90 days hot in Postgres, archived to S3 indefinitely. Match existing audit policy (cross-check before shipping).

---

## References

- shift-agent's `src/platform/qbo_client.py` (the QuickBooks integration that proves the cross-language client pattern works)
- shift-agent's `src/platform/safe_io.py` (the auth-+-state discipline this design draws from)
- `docs/agents-architecture.md` (the broader discipline this server enables agents to follow)
- MCP specification: https://modelcontextprotocol.io/specification (the protocol Vizora's server implements)
