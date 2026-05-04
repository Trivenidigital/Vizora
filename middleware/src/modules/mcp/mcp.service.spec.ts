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
  // tools/displays.tools.spec.ts.
  const displays = {} as never;
  const audit = {} as never;

  it('returns a NEW McpServer instance on every call (REGRESSION: singleton caused "Already connected to a transport" in prod)', () => {
    const svc = new McpService(displays, audit);
    const a = svc.buildServer();
    const b = svc.buildServer();
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });

  it('every fresh server has the list_displays tool registered', () => {
    const svc = new McpService(displays, audit);
    const server = svc.buildServer();
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
