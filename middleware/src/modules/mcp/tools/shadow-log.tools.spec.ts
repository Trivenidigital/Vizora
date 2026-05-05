import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { logShadowRowTool } from './shadow-log.tools';
import type { McpRequestContext } from '../auth/mcp-context';

function ctx(opts: {
  scopes: string[];
  organizationId?: string | null;
}): McpRequestContext {
  return {
    tokenId: 'tok_1',
    organizationId: opts.organizationId === undefined ? null : opts.organizationId,
    agentName: 'hermes-customer-lifecycle',
    scopes: opts.scopes,
  };
}

function makeShadowLog(opts: {
  appendRow?: jest.Mock;
}) {
  return {
    appendRow:
      opts.appendRow ??
      jest.fn().mockReturnValue({
        logName: 'vizora-customer-lifecycle-shadow',
        written: true,
        lineCount: 42,
      }),
  };
}

describe('logShadowRowTool', () => {
  it('throws ForbiddenException when shadow:write scope missing', async () => {
    const svc = makeShadowLog({});
    await expect(
      logShadowRowTool(
        { log_name: 'vizora-customer-lifecycle-shadow', fields: { a: 1 } },
        ctx({ scopes: ['customer:read'], organizationId: null }),
        svc as never,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(svc.appendRow).not.toHaveBeenCalled();
  });

  it('REJECTS per-org tokens with BadRequest — shadow logs are platform-scope artifacts', async () => {
    const svc = makeShadowLog({});
    await expect(
      logShadowRowTool(
        { log_name: 'vizora-customer-lifecycle-shadow', fields: { a: 1 } },
        ctx({ scopes: ['shadow:write'], organizationId: 'org_1' }),
        svc as never,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(svc.appendRow).not.toHaveBeenCalled();
  });

  it('forwards log_name + fields to the service when scope + token shape are correct', async () => {
    const svc = makeShadowLog({});
    const out = await logShadowRowTool(
      {
        log_name: 'vizora-customer-lifecycle-shadow',
        fields: { organization_id: 'o1', tier: 'pro' },
      },
      ctx({ scopes: ['shadow:write'], organizationId: null }),
      svc as never,
    );
    expect(svc.appendRow).toHaveBeenCalledWith(
      'vizora-customer-lifecycle-shadow',
      { organization_id: 'o1', tier: 'pro' },
    );
    expect(out).toMatchObject({
      log_name: 'vizora-customer-lifecycle-shadow',
      written: true,
      line_count: 42,
    });
    expect(out.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(out.run_id).toMatch(/^\d{10}$/);
  });

  it('rejects unknown log_name via Zod (not in the allowlist enum)', async () => {
    const svc = makeShadowLog({});
    await expect(
      logShadowRowTool(
        { log_name: 'vizora-totally-fake-log', fields: { a: 1 } },
        ctx({ scopes: ['shadow:write'], organizationId: null }),
        svc as never,
      ),
    ).rejects.toThrow();
    expect(svc.appendRow).not.toHaveBeenCalled();
  });

  it('rejects path-traversal attempts in log_name at the Zod layer (never reaches service)', async () => {
    const svc = makeShadowLog({});
    await expect(
      logShadowRowTool(
        { log_name: '../../etc/passwd', fields: { a: 1 } },
        ctx({ scopes: ['shadow:write'], organizationId: null }),
        svc as never,
      ),
    ).rejects.toThrow();
    expect(svc.appendRow).not.toHaveBeenCalled();
  });

  it('translates service oversize / allowlist failures to BadRequestException (INVALID_INPUT on the wire)', async () => {
    const svc = makeShadowLog({
      appendRow: jest.fn().mockImplementation(() => {
        throw new Error('serialized row is 5000 bytes (max 4096). Atomic append guarantee would be violated.');
      }),
    });
    await expect(
      logShadowRowTool(
        { log_name: 'vizora-customer-lifecycle-shadow', fields: { huge: 'x'.repeat(5000) } },
        ctx({ scopes: ['shadow:write'], organizationId: null }),
        svc as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes fields object straight through (server-side enrichment is the service\'s job, not the tool\'s)', async () => {
    const captured: unknown[] = [];
    const svc = makeShadowLog({
      appendRow: jest.fn((logName, fields) => {
        captured.push({ logName, fields });
        return { logName, written: true, lineCount: 1 };
      }),
    });
    await logShadowRowTool(
      {
        log_name: 'vizora-support-triage-shadow',
        fields: {
          ticket_id: 't1',
          hermes_score: 0.72,
          hermes_priority: 'high',
          // Agent attempts to control timestamp/run_id — server-side service
          // overrides these, but the tool itself just forwards them.
          timestamp: '1999-01-01T00:00:00Z',
          run_id: '<unique-id>',
        },
      },
      ctx({ scopes: ['shadow:write'], organizationId: null }),
      svc as never,
    );
    const cap = captured[0] as { logName: string; fields: Record<string, unknown> };
    expect(cap.fields.ticket_id).toBe('t1');
    expect(cap.fields.hermes_score).toBe(0.72);
    // Tool layer doesn't strip — it's the service's job to override
    expect(cap.fields.timestamp).toBe('1999-01-01T00:00:00Z');
    expect(cap.fields.run_id).toBe('<unique-id>');
  });
});
