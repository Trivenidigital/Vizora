import { evaluateTenantOp, GUARDED_MODELS, TenantGuardMode } from './tenant-guard';
import type { TenantContext } from './tenant-context';

const ORG = 'org-A';
const ctx = (over: Partial<TenantContext> = {}): TenantContext => ({ organizationId: ORG, bypass: false, ...over });
const ev = (o: Partial<Parameters<typeof evaluateTenantOp>[0]> & { operation: string; mode: TenantGuardMode }) =>
  evaluateTenantOp({ model: 'Playlist', args: {}, context: ctx(), ...o });

describe('evaluateTenantOp', () => {
  describe('always passes', () => {
    it('mode off', () => {
      expect(ev({ operation: 'updateMany', mode: 'off', args: { where: {} } }).action).toBe('pass');
    });
    it('non-guarded model (Organization, User, McpToken)', () => {
      for (const model of ['Organization', 'User', 'McpToken', 'AgentRun']) {
        expect(evaluateTenantOp({ model, operation: 'updateMany', args: { where: {} }, context: ctx(), mode: 'enforce' }).action).toBe('pass');
      }
    });
    it('no context (outside a request)', () => {
      expect(evaluateTenantOp({ model: 'Playlist', operation: 'deleteMany', args: { where: {} }, context: undefined, mode: 'enforce' }).action).toBe('pass');
    });
    it('bypass context (admin/system/cross-org)', () => {
      expect(ev({ operation: 'deleteMany', mode: 'enforce', args: { where: {} }, context: ctx({ bypass: true, organizationId: null }) }).action).toBe('pass');
    });
    it('null org without bypass (tenant unknown → cannot scope)', () => {
      expect(ev({ operation: 'deleteMany', mode: 'enforce', args: { where: {} }, context: ctx({ organizationId: null }) }).action).toBe('pass');
    });
  });

  describe('updateMany / deleteMany (where-scoped)', () => {
    it('log: warns on missing org scope; does not mutate', () => {
      const r = ev({ operation: 'updateMany', mode: 'log', args: { where: { id: 'p1' }, data: {} } });
      expect(r.action).toBe('warn');
    });
    it('enforce: injects organizationId into where', () => {
      const r = ev({ operation: 'deleteMany', mode: 'enforce', args: { where: { id: 'p1' } } });
      expect(r).toEqual({ action: 'inject', args: { where: { id: 'p1', organizationId: ORG } } });
    });
    it('passes when where already carries the correct org', () => {
      expect(ev({ operation: 'updateMany', mode: 'enforce', args: { where: { id: 'p1', organizationId: ORG }, data: {} } }).action).toBe('pass');
    });
    it('rejects a where scoped to a FOREIGN org (both modes)', () => {
      for (const mode of ['log', 'enforce'] as TenantGuardMode[]) {
        const r = ev({ operation: 'deleteMany', mode, args: { where: { organizationId: 'org-B' } } });
        expect(r.action).toBe('reject');
      }
    });
  });

  describe('update / delete (unique where — cannot inject)', () => {
    it('log: warns on bare unique where (the B9 bare-id pattern)', () => {
      const r = ev({ operation: 'update', mode: 'log', args: { where: { id: 'p1' }, data: {} } });
      expect(r.action).toBe('warn');
    });
    it('enforce: rejects with guidance to use updateMany', () => {
      const r = ev({ operation: 'delete', mode: 'enforce', args: { where: { id: 'p1' } } });
      expect(r.action).toBe('reject');
      if (r.action === 'reject') expect(r.reason).toMatch(/deleteMany/);
    });
    it('passes when the unique where carries a matching org (compound unique)', () => {
      expect(ev({ operation: 'update', mode: 'enforce', args: { where: { id: 'p1', organizationId: ORG }, data: {} } }).action).toBe('pass');
    });
  });

  describe('create / createMany (data-scoped)', () => {
    it('enforce: injects organizationId into a create missing it', () => {
      const r = ev({ operation: 'create', mode: 'enforce', args: { data: { name: 'x' } } });
      expect(r).toEqual({ action: 'inject', args: { data: { name: 'x', organizationId: ORG } } });
    });
    it('rejects a create carrying a FOREIGN organizationId', () => {
      const r = ev({ operation: 'create', mode: 'enforce', args: { data: { name: 'x', organizationId: 'org-B' } } });
      expect(r.action).toBe('reject');
    });
    it('rejects a createMany where ANY row is cross-tenant', () => {
      const r = ev({ operation: 'createMany', mode: 'enforce', args: { data: [{ organizationId: ORG }, { organizationId: 'org-B' }] } });
      expect(r.action).toBe('reject');
    });
    it('log: warns on a create missing org, does not mutate', () => {
      expect(ev({ operation: 'create', mode: 'log', args: { data: { name: 'x' } } }).action).toBe('warn');
    });
    it('passes a create already scoped to the request org', () => {
      expect(ev({ operation: 'create', mode: 'enforce', args: { data: { organizationId: ORG } } }).action).toBe('pass');
    });
  });

  it('the guarded set covers the tenant-resource models but excludes the tenant root', () => {
    expect(GUARDED_MODELS.has('Playlist')).toBe(true);
    expect(GUARDED_MODELS.has('Content')).toBe(true);
    expect(GUARDED_MODELS.has('Organization')).toBe(false);
    expect(GUARDED_MODELS.has('User')).toBe(false);
  });
});
