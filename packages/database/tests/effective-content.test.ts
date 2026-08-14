import {
  resolveEffectiveContent,
  shouldApplyContent,
  contentVersion,
  EffectivePlaylist,
} from '../src/lib/effective-content';

// Minimal Prisma-shaped mock: the resolver only touches display.findFirst,
// schedule.findMany, playlist.findFirst.
const mockDb = (opts: {
  display: any;
  schedules?: any[];
  currentPlaylist?: any;
}) =>
  ({
    display: { findFirst: async () => opts.display },
    schedule: { findMany: async () => opts.schedules ?? [] },
    playlist: { findFirst: async () => opts.currentPlaylist ?? null },
  }) as any;

const NOW = new Date('2026-02-02T10:00:00Z');
const item = (contentId: string, order: number, updatedAt: string) => ({
  contentId,
  order,
  duration: 10,
  updatedAt: new Date(updatedAt),
  content: { id: contentId, updatedAt: new Date(updatedAt) },
});

// An all-day schedule (every day, no start/end) is active at ANY time → avoids
// timezone-parse flakiness. An empty-days schedule is NEVER active.
const allDay = (id: string, playlist: any, priority = 10) => ({
  id,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startTime: null,
  endTime: null,
  priority,
  updatedAt: new Date('2026-01-01'),
  playlist,
});
const neverActive = (id: string, playlist: any) => ({
  id,
  daysOfWeek: [],
  startTime: null,
  endTime: null,
  priority: 10,
  updatedAt: new Date('2026-01-01'),
  playlist,
});

const display = { timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-current' };
const schedPlaylist = { id: 'pl-sched', updatedAt: new Date('2026-01-05'), items: [item('c1', 0, '2026-01-05')] };
const currentPlaylist = { id: 'pl-current', updatedAt: new Date('2026-01-03'), items: [item('c2', 0, '2026-01-03')] };

describe('resolveEffectiveContent — the two-layer coherence model (T2)', () => {
  // Layer 1 — PRIORITY
  it('an ACTIVE schedule overrides the currentPlaylist (returns schedule content)', async () => {
    const db = mockDb({ display, schedules: [allDay('sch-1', schedPlaylist)], currentPlaylist });
    const res = await resolveEffectiveContent(db, 'disp-1', 'org-1', NOW);
    expect(res.source).toBe('schedule');
    expect(res.playlist?.id).toBe('pl-sched');
    expect(res.scheduleId).toBe('sch-1');
  });

  it('when NO schedule is active, falls back to the currentPlaylist (priority, not recency)', async () => {
    const db = mockDb({ display, schedules: [neverActive('sch-1', schedPlaylist)], currentPlaylist });
    const res = await resolveEffectiveContent(db, 'disp-1', 'org-1', NOW);
    expect(res.source).toBe('currentPlaylist');
    expect(res.playlist?.id).toBe('pl-current');
  });

  it('the highest-priority active schedule wins (findMany is priority-ordered)', async () => {
    // findMany returns priority-desc; the resolver takes the first ACTIVE one.
    const hi = allDay('sch-hi', { id: 'pl-hi', updatedAt: new Date('2026-01-06'), items: [item('c3', 0, '2026-01-06')] }, 100);
    const lo = allDay('sch-lo', schedPlaylist, 1);
    const db = mockDb({ display, schedules: [hi, lo], currentPlaylist });
    const res = await resolveEffectiveContent(db, 'disp-1', 'org-1', NOW);
    expect(res.playlist?.id).toBe('pl-hi');
  });

  it('nothing assigned → source none, null playlist, empty version', async () => {
    const db = mockDb({ display: { timezone: 'UTC', isDisabled: false, currentPlaylistId: null }, schedules: [] });
    const res = await resolveEffectiveContent(db, 'disp-1', 'org-1', NOW);
    expect(res).toEqual({ playlist: null, source: 'none', scheduleId: null, version: '' });
  });

  // The SINGLE-DEFINITION invariant: push and pull both call this resolver, so for
  // the same state they MUST produce identical output — no channel-specific drift.
  it('is deterministic: two calls on the same state produce identical output (push == pull)', async () => {
    const db = mockDb({ display, schedules: [allDay('sch-1', schedPlaylist)], currentPlaylist });
    const a = await resolveEffectiveContent(db, 'disp-1', 'org-1', NOW);
    const b = await resolveEffectiveContent(db, 'disp-1', 'org-1', NOW);
    expect(a).toEqual(b);
  });
});

describe('shouldApplyContent — version-wins idempotency (T2 layer 2)', () => {
  it('same playlist + same version arriving twice does NOT re-apply (PD-1/PD-7 idempotency)', () => {
    const v = { playlistId: 'pl-1', version: '2026-02-02T10:00:00.000Z' };
    expect(shouldApplyContent(v, v)).toBe(false);
  });

  it('a NEWER version of the same playlist wins; an OLDER one is ignored (stale push↔pull)', () => {
    const older = { playlistId: 'pl-1', version: '2026-01-01T00:00:00.000Z' };
    const newer = { playlistId: 'pl-1', version: '2026-02-01T00:00:00.000Z' };
    expect(shouldApplyContent(newer, older)).toBe(true); // newer wins
    expect(shouldApplyContent(older, newer)).toBe(false); // older ignored
  });

  it('a DIFFERENT playlist (schedule boundary / reassignment) ALWAYS applies, even with an older version', () => {
    const current = { playlistId: 'pl-a', version: '2026-02-01T00:00:00.000Z' };
    const boundary = { playlistId: 'pl-b', version: '2026-01-01T00:00:00.000Z' }; // older stamp, different playlist
    expect(shouldApplyContent(boundary, current)).toBe(true);
  });

  it('first content (no current) applies; a null-playlist resolution never applies', () => {
    expect(shouldApplyContent({ playlistId: 'pl-1', version: 'v' }, null)).toBe(true);
    expect(shouldApplyContent({ playlistId: null, version: '' }, { playlistId: 'pl-1', version: 'v' })).toBe(false);
  });
});

describe('contentVersion — monotonic across all content changes', () => {
  const pl = (items: any[], updatedAt: string): EffectivePlaylist => ({ id: 'p', updatedAt: new Date(updatedAt), items });
  it('is the max updatedAt across playlist + items + content', () => {
    const v = contentVersion(pl([item('c1', 0, '2026-01-05'), item('c2', 1, '2026-03-01')], '2026-01-01'), null);
    expect(v).toBe(new Date('2026-03-01').toISOString());
  });
  it('an in-place content edit (bumped content.updatedAt) raises the version', () => {
    const before = contentVersion(pl([item('c1', 0, '2026-01-05')], '2026-01-01'), null);
    const after = contentVersion(pl([item('c1', 0, '2026-06-05')], '2026-01-01'), null);
    expect(after > before).toBe(true);
  });
  it('empty/null → empty version', () => {
    expect(contentVersion(null, null)).toBe('');
    expect(contentVersion(pl([], '2026-01-01'), null)).toBe(new Date('2026-01-01').toISOString());
  });

  // The deployed player gates on `incoming.version > current.version` (string compare,
  // vizora-tv src/utils.ts:56). A version that CHANGES without INCREASING is silently
  // ignored by every device in the field — which is what a content hash would have
  // produced. "Different" is not the contract; "greater" is. These assert the contract
  // the client actually implements, not merely that the stamp moved.
  it('an in-place content edit is ACCEPTED by the deployed client gate, not just different', () => {
    const playlistId = 'p';
    const before = contentVersion(pl([item('c1', 0, '2026-01-05')], '2026-01-01'), null);
    const after = contentVersion(pl([item('c1', 0, '2026-06-05')], '2026-01-01'), null);
    expect(after).not.toBe(before);
    expect(after > before).toBe(true); // strictly greater, the property `>` needs
    expect(shouldApplyContent({ playlistId, version: after }, { playlistId, version: before })).toBe(true);
    // ...and the reverse delivery (a stale re-send) is still correctly ignored.
    expect(shouldApplyContent({ playlistId, version: before }, { playlistId, version: after })).toBe(false);
  });

  it('every version is lexicographically ordered — the property a hash would break', () => {
    // Guards the format itself: ISO-8601 UTC is fixed-width, so string order == time
    // order. Swap in a hash (or a locale/offset-formatted date) and this fails.
    const stamps = ['2026-01-05', '2026-02-01', '2026-06-05', '2027-01-01'];
    const versions = stamps.map((s) => contentVersion(pl([item('c1', 0, s)], '2026-01-01'), null));
    expect(versions).toEqual([...versions].sort());
    for (const v of versions) expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // 24 chars — inside the 64-char contentVersion cap the heartbeat DTO enforces.
    for (const v of versions) expect(v.length).toBeLessThanOrEqual(64);
  });
});

/**
 * Vizora#325 — version MONOTONICITY across item removal.
 *
 * The invariant: for a given playlist, every semantic change to what a device should
 * show must yield a version STRICTLY GREATER than the last one issued. The shipped
 * client refuses a same-playlist payload whose version did not advance, so a version
 * that stalls or regresses does not merely mis-label the payload — it makes the
 * CORRECTED payload undeliverable, and the screen keeps rendering archived/expired
 * content indefinitely.
 *
 * Both halves below are load-bearing and neither subsumes the other:
 *   archive  is a WRITE      -> covered by versioning over the unfiltered item set
 *   expiry   is WRITE-FREE   -> covered ONLY by stamping expiresAt once crossed
 */
describe('Vizora#325 — content version never regresses when an item stops being served', () => {
  const NOW325 = new Date('2026-03-01T12:00:00Z');
  const disp = { timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-1' };

  // Deliberately explicit about status/expiresAt — production always selects both
  // (`include: { content: true }`), and these tests are about exactly those fields.
  const c = (
    id: string,
    updatedAt: string,
    extra: { status?: string; expiresAt?: string | null } = {},
  ) => ({
    contentId: id,
    order: 0,
    duration: 10,
    content: {
      id,
      updatedAt: new Date(updatedAt),
      status: extra.status ?? 'active',
      expiresAt: extra.expiresAt ? new Date(extra.expiresAt) : null,
    },
  });

  const playlistWith = (items: any[]) => ({
    id: 'pl-1',
    updatedAt: new Date('2026-01-01T00:00:00Z'), // structural floor, deliberately OLD
    items,
  });

  const resolveWith = (items: any[], now = NOW325) =>
    resolveEffectiveContent(
      mockDb({ display: disp, currentPlaylist: playlistWith(items) }) as any,
      'disp-1',
      'org-1',
      now,
    );

  it('ARCHIVE of the max-carrying item: it stops being served, and the version RISES', async () => {
    // B is the newest thing in the playlist, so it carries the version.
    const before = await resolveWith([c('a', '2026-02-01T00:00:00Z'), c('b', '2026-02-20T00:00:00Z')]);
    expect(before.playlist!.items!.map((i: any) => i.contentId)).toEqual(['a', 'b']);

    // Archiving is a WRITE: status flips AND updatedAt bumps to the write time.
    const after = await resolveWith([
      c('a', '2026-02-01T00:00:00Z'),
      c('b', '2026-02-25T00:00:00Z', { status: 'archived' }),
    ]);

    // Served set shrank — the S1-2 filter still works...
    expect(after.playlist!.items!.map((i: any) => i.contentId)).toEqual(['a']);
    // ...and the version went FORWARD, so the client will accept the corrected payload.
    expect(after.version > before.version).toBe(true);
  });

  it('EXPIRY boundary with NO intervening write: it stops being served, and the version RISES', async () => {
    // The deterministic case, and the one an unfiltered-max fix alone does NOT solve.
    // setExpiration wrote updatedAt=T0 and expiresAt=T1 (T1 > T0). Crossing T1 runs no
    // code anywhere — identical rows, only the clock moved.
    const items = [
      c('a', '2026-02-01T00:00:00Z'),
      c('b', '2026-02-10T00:00:00Z', { expiresAt: '2026-02-15T00:00:00Z' }),
    ];
    const beforeBoundary = await resolveWith(items, new Date('2026-02-14T00:00:00Z'));
    const afterBoundary = await resolveWith(items, new Date('2026-02-16T00:00:00Z'));

    expect(beforeBoundary.playlist!.items!.map((i: any) => i.contentId)).toEqual(['a', 'b']);
    expect(afterBoundary.playlist!.items!.map((i: any) => i.contentId)).toEqual(['a']);
    expect(afterBoundary.version > beforeBoundary.version).toBe(true);
    // The advance comes from the BOUNDARY itself, not from any row changing.
    expect(afterBoundary.version).toBe(new Date('2026-02-15T00:00:00Z').toISOString());
  });

  it('a FUTURE expiry is not stamped early — it must not swallow later genuine edits', async () => {
    // If expiresAt were pushed unconditionally the version would jump ahead of real
    // time, and every real edit before that date would then fail to raise it.
    const res = await resolveWith(
      [c('a', '2026-02-01T00:00:00Z', { expiresAt: '2027-01-01T00:00:00Z' })],
      NOW325,
    );
    expect(res.version).toBe(new Date('2026-02-01T00:00:00Z').toISOString());

    const afterEdit = await resolveWith(
      [c('a', '2026-02-05T00:00:00Z', { expiresAt: '2027-01-01T00:00:00Z' })],
      NOW325,
    );
    expect(afterEdit.version > res.version).toBe(true);
  });

  it('BULK archive of every remaining item still raises the version', async () => {
    const before = await resolveWith([c('a', '2026-02-01T00:00:00Z'), c('b', '2026-02-02T00:00:00Z')]);
    const after = await resolveWith([
      c('a', '2026-02-26T00:00:00Z', { status: 'archived' }),
      c('b', '2026-02-27T00:00:00Z', { status: 'archived' }),
    ]);
    expect(after.playlist!.items).toEqual([]); // nothing served
    expect(after.version > before.version).toBe(true); // but the device is TOLD
  });

  it('NEGATIVE CONTROL: versioning over only the SERVED items reproduces the bug', async () => {
    // This is what the code did before, and what a naive "just filter later" fix would
    // still do. It must FAIL the two cases above — otherwise those tests prove nothing
    // about WHICH set is being versioned.
    const served = (items: any[], now: Date) =>
      items.filter((i) => {
        if (i.content.status !== 'active') return false;
        return !i.content.expiresAt || new Date(i.content.expiresAt).getTime() > now.getTime();
      });
    const oldVersion = (items: any[], now: Date) =>
      contentVersion(playlistWith(served(items, now)) as unknown as EffectivePlaylist, null, { now });

    // Archive: version goes BACKWARDS (b's newer stamp disappears along with b).
    const archBefore = [c('a', '2026-02-01T00:00:00Z'), c('b', '2026-02-20T00:00:00Z')];
    const archAfter = [c('a', '2026-02-01T00:00:00Z'), c('b', '2026-02-25T00:00:00Z', { status: 'archived' })];
    expect(oldVersion(archAfter, NOW325) < oldVersion(archBefore, NOW325)).toBe(true);

    // Write-free expiry: the version REGRESSES to a's stamp, so the client cannot be told.
    const expItems = [
      c('a', '2026-02-01T00:00:00Z'),
      c('b', '2026-02-10T00:00:00Z', { expiresAt: '2026-02-15T00:00:00Z' }),
    ];
    const preBoundary = oldVersion(expItems, new Date('2026-02-14T00:00:00Z'));
    const postBoundary = oldVersion(expItems, new Date('2026-02-16T00:00:00Z'));
    expect(postBoundary < preBoundary).toBe(true);
  });

  it('a different-playlist reassignment is still applied regardless of its timestamp', async () => {
    // The reason a blanket server-side "lower version => do not signal" guard was NOT
    // added: an older playlist is a legitimate destination, and the client applies a
    // different playlist unconditionally. Nothing here may break that.
    const older = { playlistId: 'pl-2', version: '2026-01-01T00:00:00.000Z' };
    const newer = { playlistId: 'pl-1', version: '2026-02-20T00:00:00.000Z' };
    expect(shouldApplyContent(older, newer)).toBe(true);
  });
});
