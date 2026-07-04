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
});
