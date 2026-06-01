import { DisplaysService } from './displays.service';
import { DatabaseService } from '../database/database.service';

/**
 * O4 — Verifies that `addTags`/`removeTags` emit `display.tags.changed` so the
 * TagRuleEvaluator can react. Sibling spec rather than additions to the big
 * displays.service.spec.ts — keeps the dependency-mock surface tiny.
 */
describe('DisplaysService — display.tags.changed emission (O4)', () => {
  let service: DisplaysService;
  let db: any;
  let eventEmitter: { emit: jest.Mock };

  const orgId = 'org-1';
  const displayId = 'display-1';

  beforeEach(() => {
    db = {
      display: { findFirst: jest.fn().mockResolvedValue({ id: displayId, organizationId: orgId }) },
      displayTag: {
        upsert: jest.fn().mockResolvedValue({ tag: { id: 'tag-1', name: 'lobby' } }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tag: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.id.in.map((id: string) => ({ id }))),
        ),
      },
    };
    eventEmitter = { emit: jest.fn() };

    // Constructor: (db, jwt, http, circuitBreaker, storage, eventEmitter)
    service = new DisplaysService(
      db as unknown as DatabaseService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventEmitter as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('addTags emits display.tags.changed with { organizationId, displayId }', async () => {
    await service.addTags(orgId, displayId, ['tag-1']);

    expect(eventEmitter.emit).toHaveBeenCalledWith('display.tags.changed', {
      organizationId: orgId,
      displayId,
    });
  });

  it('removeTags emits display.tags.changed with { organizationId, displayId }', async () => {
    await service.removeTags(orgId, displayId, ['tag-1']);

    expect(eventEmitter.emit).toHaveBeenCalledWith('display.tags.changed', {
      organizationId: orgId,
      displayId,
    });
  });

  it('addTags emits exactly once even with multiple tagIds (one event per call, not per tag)', async () => {
    await service.addTags(orgId, displayId, ['tag-1', 'tag-2', 'tag-3']);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});
