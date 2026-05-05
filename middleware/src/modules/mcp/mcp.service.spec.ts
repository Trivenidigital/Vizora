import { McpService } from './mcp.service';

/**
 * Regression: PR #42 shipped a singleton `McpServer` field on McpService
 * and the controller called `service.server.connect(transport)` per
 * request. The SDK's `Server.connect()` is single-shot — every request
 * after the first threw "Already connected to a transport". Caught
 * end-to-end by Hermes hitting `tools/list` against prod.
 *
 * The fix: McpService exposes `buildServer()` which returns a NEW
 * `McpServer` per call. These tests pin that contract. If a future
 * refactor reintroduces the singleton, both assertions fail.
 */
describe('McpService.buildServer', () => {
  // Lightweight stubs — the factory itself doesn't call into them; it
  // only registers the handler closures. Tool execution is covered by
  // tools/displays.tools.spec.ts and tools/support.tools.spec.ts.
  const displays = {} as never;
  const support = {} as never;
  const organizations = {} as never;
  const audit = {} as never;
  const shadowLog = {} as never;

  it('returns a NEW McpServer instance on every call (REGRESSION: singleton caused "Already connected to a transport" in prod)', () => {
    const svc = new McpService(displays, support, organizations, audit, shadowLog);
    const a = svc.buildServer(undefined);
    const b = svc.buildServer(undefined);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });

  it('captures the request context in tool-handler closures (REGRESSION: previously plumbed through SDK extra.authInfo.extra and the SDK silently dropped it — every tool call threw "MCP tool invoked without context")', async () => {
    const captured: unknown[] = [];
    const fakeDisplays = {
      findAll: jest.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    } as never;
    const fakeAudit = { record: jest.fn(async (row) => { captured.push(row); }) } as never;
    const fakeSupport = {} as never;
    const fakeOrganizations = {} as never;
    const fakeShadowLog = {} as never;
    const svc = new McpService(fakeDisplays, fakeSupport, fakeOrganizations, fakeAudit, fakeShadowLog);
    const ctx = {
      tokenId: 'tok_test',
      organizationId: 'org_test',
      agentName: 'unit-test-agent',
      scopes: ['displays:read'],
    };
    const server = svc.buildServer(ctx);
    // Pull out the registered handler closure and invoke it directly.
    // The McpServer SDK 1.x stores it at _registeredTools[name].handler.
    const handler = (server as unknown as {
      _registeredTools: Record<string, { handler: (input: unknown) => Promise<unknown> }>;
    })._registeredTools.list_displays.handler;
    await handler({});
    // Audit row must show the captured context's org + agent — this is
    // the proof that the closure picked up the per-request ctx, not a
    // stale singleton or undefined.
    expect(fakeAudit.record).toHaveBeenCalledTimes(1);
    expect(captured[0]).toMatchObject({
      tokenId: 'tok_test',
      agentName: 'unit-test-agent',
      organizationId: 'org_test',
    });
  });

  it('still has list_displays registered on every fresh build', () => {
    const svc = new McpService(displays, support, organizations, audit, shadowLog);
    const server = svc.buildServer(undefined);
    // McpServer.server is the underlying Server instance from the SDK.
    // Tools live in its `_registeredTools` map (private but stable
    // across SDK 1.x). Falling back to checking the public `tool` API
    // would require constructing a Transport — heavier than this
    // regression needs.
    const registered = (server as unknown as { _registeredTools?: Record<string, unknown> })._registeredTools
      ?? (server as unknown as { tools?: { list_displays?: unknown } }).tools;
    // Either field shape proves registration ran; the assertion is
    // simply that *some* representation of the tool is present.
    expect(
      Boolean(
        (registered as Record<string, unknown> | undefined)?.list_displays,
      ),
    ).toBe(true);
  });
});
