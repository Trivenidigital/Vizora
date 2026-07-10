import { deriveTenantContext } from './tenant-context.interceptor';

describe('deriveTenantContext', () => {
  it('scopes to a user org', () => {
    expect(deriveTenantContext({ user: { organizationId: 'org-1' } })).toEqual({ organizationId: 'org-1', bypass: false });
  });

  it('super-admin → bypass (cross-org)', () => {
    expect(deriveTenantContext({ user: { organizationId: 'org-1', isSuperAdmin: true } })).toEqual({ organizationId: null, bypass: true });
  });

  it('device token org', () => {
    expect(deriveTenantContext({ deviceAuthPayload: { organizationId: 'org-dev' } })).toEqual({ organizationId: 'org-dev', bypass: false });
  });

  it('MCP per-org principal (attached at __mcpContext, not req.user)', () => {
    expect(deriveTenantContext({ ['__mcpContext']: { organizationId: 'org-mcp' } } as never)).toEqual({ organizationId: 'org-mcp', bypass: false });
  });

  it('MCP platform token (org null) → bypass', () => {
    expect(deriveTenantContext({ ['__mcpContext']: { organizationId: null } } as never)).toEqual({ organizationId: null, bypass: true });
  });

  it('no principal at all → bypass (log passes; enforce-fail-closed is a documented decision)', () => {
    expect(deriveTenantContext({})).toEqual({ organizationId: null, bypass: true });
  });

  it('user org takes precedence over device/mcp when both present', () => {
    expect(deriveTenantContext({ user: { organizationId: 'org-user' }, deviceAuthPayload: { organizationId: 'org-dev' } }))
      .toEqual({ organizationId: 'org-user', bypass: false });
  });
});
