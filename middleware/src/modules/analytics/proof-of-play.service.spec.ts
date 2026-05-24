import { AnalyticsService } from './analytics.service';
import { DatabaseService } from '../database/database.service';

/**
 * O2 — Proof-of-play service tests.
 *
 * Sibling spec to analytics.service.spec.ts. Focused on the new methods
 * (getProofOfPlay, streamProofOfPlayCsv) rather than re-mounting the whole
 * AnalyticsService setup.
 */
describe('AnalyticsService — Proof of play (O2)', () => {
  let service: AnalyticsService;
  let db: any;

  const orgId = 'org-123';

  beforeEach(() => {
    db = {
      contentImpression: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new AnalyticsService(db as unknown as DatabaseService);
  });

  // ---------------------------------------------------------------------------
  // getProofOfPlay
  // ---------------------------------------------------------------------------
  describe('getProofOfPlay', () => {
    it('returns paginated impressions scoped to the caller org', async () => {
      db.contentImpression.findMany.mockResolvedValue([
        {
          id: 'i1',
          timestamp: new Date(),
          contentId: 'c1',
          displayId: 'd1',
          playlistId: 'pl1',
          duration: 30,
          completionPercentage: 100,
          content: { id: 'c1', name: 'Promo' },
          display: { id: 'd1', nickname: 'Lobby', deviceIdentifier: 'mac-1' },
        },
      ]);
      db.contentImpression.count.mockResolvedValue(1);

      const result = await service.getProofOfPlay(orgId, { page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
      expect(db.contentImpression.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgId }),
        }),
      );
    });

    it('clamps page to >= 1 and limit to 1..500', async () => {
      await service.getProofOfPlay(orgId, { page: 0, limit: 10000 });

      const call = db.contentImpression.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0); // page=1 effective
      expect(call.take).toBe(500); // limit capped
    });

    it('applies all four resource filters', async () => {
      await service.getProofOfPlay(orgId, {
        contentId: 'c1',
        displayId: 'd1',
        playlistId: 'pl1',
        displayTagId: 'tag-lobby',
      });

      const where = db.contentImpression.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe(orgId);
      expect(where.contentId).toBe('c1');
      expect(where.displayId).toBe('d1');
      expect(where.playlistId).toBe('pl1');
      expect(where.display).toEqual({ tags: { some: { tagId: 'tag-lobby' } } });
    });

    it('applies date-range filter only when at least one bound is provided', async () => {
      await service.getProofOfPlay(orgId, { dateFrom: '2026-05-01', dateTo: '2026-05-31' });

      const where = db.contentImpression.findMany.mock.calls[0][0].where;
      expect(where.date.gte).toEqual(new Date('2026-05-01'));
      expect(where.date.lte).toEqual(new Date('2026-05-31'));
    });

    it('does NOT include a date predicate when no date bounds given', async () => {
      await service.getProofOfPlay(orgId, {});

      const where = db.contentImpression.findMany.mock.calls[0][0].where;
      expect(where.date).toBeUndefined();
    });

    it('returns empty data + zero total for orgs with no impressions', async () => {
      db.contentImpression.findMany.mockResolvedValue([]);
      db.contentImpression.count.mockResolvedValue(0);

      const result = await service.getProofOfPlay(orgId, {});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // streamProofOfPlayCsv
  // ---------------------------------------------------------------------------
  describe('streamProofOfPlayCsv', () => {
    async function collect(gen: AsyncGenerator<string>): Promise<string> {
      let out = '';
      for await (const chunk of gen) out += chunk;
      return out;
    }

    it('emits the header row even with zero data', async () => {
      const out = await collect(service.streamProofOfPlayCsv(orgId, {}));
      const lines = out.split('\n').filter((l) => l.length > 0);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        'timestamp,contentId,contentName,displayId,displayName,playlistId,duration_sec,completion_percent',
      );
    });

    it('emits one CSV row per impression', async () => {
      const row = {
        timestamp: new Date('2026-05-19T10:00:00Z'),
        contentId: 'c1',
        displayId: 'd1',
        playlistId: 'pl1',
        duration: 30,
        completionPercentage: 100,
        content: { id: 'c1', name: 'Promo' },
        display: { id: 'd1', nickname: 'Lobby', deviceIdentifier: 'mac-1' },
      };
      db.contentImpression.findMany
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([]); // batch loop terminates on empty

      const out = await collect(service.streamProofOfPlayCsv(orgId, {}));
      const lines = out.split('\n').filter((l) => l.length > 0);
      expect(lines).toHaveLength(2); // header + 1 row
      expect(lines[1]).toBe('2026-05-19T10:00:00.000Z,c1,Promo,d1,Lobby,pl1,30,100');
    });

    it('neutralizes Excel-injection attempts (leading =, +, -, @)', async () => {
      const row = {
        timestamp: new Date('2026-05-19T10:00:00Z'),
        contentId: 'c1',
        displayId: 'd1',
        playlistId: null,
        duration: null,
        completionPercentage: null,
        content: { id: 'c1', name: '=SUM(A1:A2)' }, // attacker-controlled content name
        display: { id: 'd1', nickname: '+CMD|calc.exe', deviceIdentifier: 'mac-1' },
      };
      db.contentImpression.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

      const out = await collect(service.streamProofOfPlayCsv(orgId, {}));
      // Each suspect cell must have a leading single-quote prefix
      expect(out).toContain("'=SUM(A1:A2)");
      expect(out).toContain("'+CMD|calc.exe");
    });

    it('formats the timestamp column in the requested IANA timezone', async () => {
      // 15:00 UTC = 11:00 EDT in May (DST). Confirms operator's tz
      // parameter is honored end-to-end without breaking the static
      // header (downstream parsers stay backward-compatible).
      const row = {
        timestamp: new Date('2026-05-19T15:00:00Z'),
        contentId: 'c1',
        displayId: 'd1',
        playlistId: null,
        duration: 30,
        completionPercentage: 100,
        content: { id: 'c1', name: 'Promo' },
        display: { id: 'd1', nickname: 'NY Lobby', deviceIdentifier: 'mac-1' },
      };
      db.contentImpression.findMany
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([]);

      const out = await collect(
        service.streamProofOfPlayCsv(orgId, { tz: 'America/New_York' }),
      );
      const lines = out.split('\n').filter((l) => l.length > 0);
      // Header is unchanged (no tz suffix) so existing parsers keep working.
      expect(lines[0]).toBe(
        'timestamp,contentId,contentName,displayId,displayName,playlistId,duration_sec,completion_percent',
      );
      // Cell carries the localized timestamp + tz tag.
      expect(lines[1]).toContain('2026-05-19 11:00:00 America/New_York');
    });

    it('falls back to UTC ISO when tz is invalid (does not 500)', async () => {
      const row = {
        timestamp: new Date('2026-05-19T15:00:00Z'),
        contentId: 'c1',
        displayId: 'd1',
        playlistId: null,
        duration: null,
        completionPercentage: null,
        content: { id: 'c1', name: 'Promo' },
        display: { id: 'd1', nickname: 'Foo', deviceIdentifier: 'mac-1' },
      };
      db.contentImpression.findMany
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([]);

      const out = await collect(
        service.streamProofOfPlayCsv(orgId, { tz: 'Not/A_RealTimezone' }),
      );
      const lines = out.split('\n').filter((l) => l.length > 0);
      // Invalid tz silently falls back to UTC ISO format.
      expect(lines[1]).toContain('2026-05-19T15:00:00.000Z');
    });

    it('CSV-escapes cells containing commas, quotes, or newlines', async () => {
      const row = {
        timestamp: new Date('2026-05-19T10:00:00Z'),
        contentId: 'c1',
        displayId: 'd1',
        playlistId: null,
        duration: null,
        completionPercentage: null,
        content: { id: 'c1', name: 'Promo, "Awesome" Edition' },
        display: { id: 'd1', nickname: 'Lobby\nTV', deviceIdentifier: 'mac-1' },
      };
      db.contentImpression.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

      const out = await collect(service.streamProofOfPlayCsv(orgId, {}));
      // The full content name with comma + escaped quotes
      expect(out).toContain('"Promo, ""Awesome"" Edition"');
      // Newline cell gets quoted
      expect(out).toContain('"Lobby\nTV"');
    });

    it('respects the 100k row safety cap', async () => {
      // Pretend each batch returns 1000 rows; the loop should fire 100 times max
      const fakeRow = {
        timestamp: new Date(),
        contentId: 'c',
        displayId: 'd',
        playlistId: null,
        duration: 1,
        completionPercentage: 100,
        content: { id: 'c', name: 'x' },
        display: { id: 'd', nickname: 'y', deviceIdentifier: 'z' },
      };
      const fullBatch = Array(1000).fill(fakeRow);
      db.contentImpression.findMany.mockResolvedValue(fullBatch);

      const gen = service.streamProofOfPlayCsv(orgId, {});
      let count = 0;
      for await (const _ of gen) {
        count++;
        if (count > 100_002) break; // safety break for the test itself
      }
      // Header + 100k rows = 100,001 chunks
      expect(count).toBeLessThanOrEqual(100_001);
    });
  });
});
