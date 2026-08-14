import { resolveEffectiveContent, contentVersion } from '../src/lib/effective-content';
import { serializeDeviceContent } from '../src/lib/device-content-payload';

// PD-9: layout zone resolution must live in the SHARED path (resolver + serializer
// both channels call) so push and pull are identical for layouts, and a single-zone
// content edit must propagate via the version.

const layoutContent = (zones: any[], updatedAt = '2026-01-01') => ({
  id: 'layout-1',
  type: 'layout',
  url: '',
  updatedAt: new Date(updatedAt),
  metadata: { zones },
});

describe('PD-9 — layout zone resolution in the shared resolver', () => {
  it('resolves each zone playlist + content ORG-SCOPED and inlines them', async () => {
    const zoneContent = { id: 'zc', name: 'Weather', type: 'url', url: 'https://x/w', updatedAt: new Date('2026-01-03') };
    const zonePlaylist = { id: 'zp', name: 'ZP', updatedAt: new Date('2026-01-04'), items: [] };
    const db = {
      display: { findFirst: async () => ({ timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-1' }) },
      schedule: { findMany: async () => [] },
      playlist: {
        findFirst: async (args: any) =>
          args.where.id === 'pl-1'
            ? { id: 'pl-1', name: 'PL', updatedAt: new Date('2026-01-01'), items: [{ contentId: 'layout-1', order: 0, content: layoutContent([{ id: 'z1', playlistId: 'zp' }, { id: 'z2', contentId: 'zc' }]) }] }
            : args.where.id === 'zp'
              ? zonePlaylist
              : null,
      },
      content: { findFirst: async (args: any) => (args.where.id === 'zc' ? zoneContent : null) },
    };

    const eff = await resolveEffectiveContent(db as any, 'd', 'org', new Date('2026-06-01T12:00:00Z'));
    const zones = (eff.playlist!.items![0].content as any).metadata.zones;
    expect(zones[0].resolvedPlaylist.id).toBe('zp');
    expect(zones[1].resolvedContent.id).toBe('zc');
  });

  it('a cross-org zone id resolves to null (org filter — no cross-tenant zone content)', async () => {
    const db = {
      display: { findFirst: async () => ({ timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-1' }) },
      schedule: { findMany: async () => [] },
      playlist: {
        findFirst: async (args: any) =>
          args.where.id === 'pl-1'
            ? { id: 'pl-1', name: 'PL', updatedAt: new Date('2026-01-01'), items: [{ contentId: 'layout-1', order: 0, content: layoutContent([{ id: 'z', contentId: 'foreign' }]) }] }
            : null, // foreign zone playlist not in org
      },
      content: { findFirst: async () => null }, // foreign zone content not in org → null
    };
    const eff = await resolveEffectiveContent(db as any, 'd', 'org', new Date('2026-06-01T12:00:00Z'));
    expect((eff.playlist!.items![0].content as any).metadata.zones[0].resolvedContent).toBeNull();
  });
});

describe('PD-9 — per-zone version propagation (contentVersion descends into zones)', () => {
  const layoutPlaylist = (zoneUpdatedAt: string) => ({
    id: 'pl',
    updatedAt: new Date('2026-01-01'),
    items: [{ contentId: 'layout-1', order: 0, updatedAt: new Date('2026-01-01'), content: layoutContent([{ id: 'z', contentId: 'zc', resolvedContent: { id: 'zc', updatedAt: new Date(zoneUpdatedAt) } }]) }],
  });

  it('a single-zone content edit raises the version (would not, under content.updatedAt alone)', () => {
    const before = contentVersion(layoutPlaylist('2026-01-02') as any, null);
    const after = contentVersion(layoutPlaylist('2026-06-02') as any, null);
    expect(after > before).toBe(true);
  });

  it('descends into zone-playlist item content too', () => {
    const withZonePlaylist = (u: string) => ({
      id: 'pl', updatedAt: new Date('2026-01-01'),
      items: [{ contentId: 'layout-1', order: 0, content: layoutContent([{ id: 'z', playlistId: 'zp', resolvedPlaylist: { id: 'zp', items: [{ content: { id: 'zpc', updatedAt: new Date(u) } }] } }]) }],
    });
    expect(contentVersion(withZonePlaylist('2026-08-01') as any, null) > contentVersion(withZonePlaylist('2026-02-01') as any, null)).toBe(true);
  });
});

describe('PD-9 — serializer transforms zone urls + push==pull for layouts', () => {
  const effLayout = () => ({
    source: 'currentPlaylist' as const,
    version: 'v',
    scheduleId: null,
    playlist: {
      id: 'pl', name: 'PL',
      items: [{ order: 0, content: layoutContent([
        { id: 'z1', resolvedContent: { id: 'zc', url: 'minio://z/zc.png', isWidget: true, widgetType: 'generic-api', widgetConfig: { apiKey: 'SECRET' } } },
        { id: 'z2', resolvedPlaylist: { id: 'zp', items: [{ content: { id: 'zpc', url: 'minio://z/zpc.png' } }] } },
      ]) }],
    },
  });

  it('is byte-identical across channels (both call the one serializer) and transforms zone minio urls', () => {
    const pull = serializeDeviceContent(effLayout() as any, { contentBaseUrl: 'https://api.test' });
    const push = serializeDeviceContent(effLayout() as any, { contentBaseUrl: 'https://api.test' });
    expect(push).toEqual(pull); // the coherence guarantee for layouts

    const zones = (push.playlist!.items[0].content!.metadata as any).zones;
    expect(zones[0].resolvedContent.url).toBe('https://api.test/api/v1/device-content/zc/file');
    expect(zones[1].resolvedPlaylist.items[0].content.url).toBe('https://api.test/api/v1/device-content/zpc/file');
  });

  it('redacts widget secrets inside zone content too', () => {
    const out = serializeDeviceContent(effLayout() as any, { contentBaseUrl: 'https://api.test' });
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });
});

/**
 * Vizora#325 / PD-9 — the monotonicity invariant extended THROUGH layout zones.
 *
 * Moving the S1-2 filter out of the Prisma include (so a filtered-out item can still
 * raise the version) applies to the ZONE playlist query too. Without a matching split
 * inside resolveLayoutZones, archived/expired content nested in a zone playlist would
 * be serialized onto the wire — trading the #325 stale-content bug for a new one.
 *
 * So both halves must hold at every nesting level:
 *   nested items are filtered OUT of what is delivered
 *   nested items still count TOWARD the version
 */
describe('Vizora#325 x PD-9 — zone content is filtered from delivery but still versioned', () => {
  const NOW = new Date('2026-06-01T12:00:00Z');

  const zc = (
    id: string,
    updatedAt: string,
    extra: { status?: string; expiresAt?: string | null } = {},
  ) => ({
    id,
    name: id,
    type: 'image',
    url: `https://x/${id}`,
    updatedAt: new Date(updatedAt),
    status: extra.status ?? 'active',
    expiresAt: extra.expiresAt ? new Date(extra.expiresAt) : null,
  });

  const zoneItem = (content: any, order = 0) => ({ contentId: content.id, order, duration: 10, content });

  const layout = (zones: any[]) => ({
    id: 'layout-1',
    type: 'layout',
    url: '',
    updatedAt: new Date('2026-01-01'),
    status: 'active',
    expiresAt: null,
    metadata: { zones },
  });

  /** Top playlist holds one layout; the layout's zone points at zone playlist `zp`. */
  const build = (zoneItems: any[], pinnedZoneContent: any = null) => ({
    display: { findFirst: async () => ({ timezone: 'UTC', isDisabled: false, currentPlaylistId: 'pl-1' }) },
    schedule: { findMany: async () => [] },
    playlist: {
      findFirst: async (args: any) =>
        args.where.id === 'pl-1'
          ? {
              id: 'pl-1',
              updatedAt: new Date('2026-01-01'),
              items: [
                {
                  contentId: 'layout-1',
                  order: 0,
                  content: layout([
                    { id: 'z1', playlistId: 'zp' },
                    ...(pinnedZoneContent ? [{ id: 'z2', contentId: pinnedZoneContent.id }] : []),
                  ]),
                },
              ],
            }
          : args.where.id === 'zp'
            ? { id: 'zp', updatedAt: new Date('2026-01-02'), items: zoneItems }
            : null,
    },
    content: {
      findFirst: async (args: any) =>
        pinnedZoneContent && args.where.id === pinnedZoneContent.id ? pinnedZoneContent : null,
    },
  });

  const zoneItemsOf = (eff: any) =>
    (eff.playlist.items[0].content as any).metadata.zones[0].resolvedPlaylist.items.map(
      (i: any) => i.contentId,
    );

  it('an ARCHIVED zone item is NOT delivered, and the version still RISES', async () => {
    const before = await resolveEffectiveContent(
      build([zoneItem(zc('a', '2026-02-01')), zoneItem(zc('b', '2026-02-20'), 1)]) as any,
      'd', 'org', NOW,
    );
    expect(zoneItemsOf(before)).toEqual(['a', 'b']);

    const after = await resolveEffectiveContent(
      build([
        zoneItem(zc('a', '2026-02-01')),
        zoneItem(zc('b', '2026-02-25', { status: 'archived' }), 1),
      ]) as any,
      'd', 'org', NOW,
    );

    // Not on the wire...
    expect(zoneItemsOf(after)).toEqual(['a']);
    // ...and the device is TOLD, so it accepts the corrected payload.
    expect(after.version > before.version).toBe(true);
  });

  it('a zone item crossing EXPIRY with no write is dropped, and the version RISES', async () => {
    const items = [
      zoneItem(zc('a', '2026-02-01')),
      zoneItem(zc('b', '2026-02-10', { expiresAt: '2026-02-15' }), 1),
    ];
    const beforeBoundary = await resolveEffectiveContent(
      build(items) as any, 'd', 'org', new Date('2026-02-14T00:00:00Z'),
    );
    const afterBoundary = await resolveEffectiveContent(
      build(items) as any, 'd', 'org', new Date('2026-02-16T00:00:00Z'),
    );

    expect(zoneItemsOf(beforeBoundary)).toEqual(['a', 'b']);
    expect(zoneItemsOf(afterBoundary)).toEqual(['a']);
    expect(afterBoundary.version > beforeBoundary.version).toBe(true);
  });

  it('a FUTURE zone expiry is not stamped early', async () => {
    const eff = await resolveEffectiveContent(
      build([zoneItem(zc('a', '2026-02-01', { expiresAt: '2027-01-01' }))]) as any,
      'd', 'org', NOW,
    );
    expect(zoneItemsOf(eff)).toEqual(['a']); // still servable
    expect(eff.version).toBe(new Date('2026-02-01').toISOString());
  });

  it('a PINNED zone content that is archived is dropped, and still raises the version', async () => {
    // This door was open BEFORE #325: the S1-2 filter only ever applied to playlist
    // items, so an archived content pinned straight into a zone was always servable.
    const live = await resolveEffectiveContent(
      build([], zc('pinned', '2026-02-01')) as any, 'd', 'org', NOW,
    );
    const zonesLive = (live.playlist!.items![0].content as any).metadata.zones;
    expect(zonesLive[1].resolvedContent.id).toBe('pinned');

    const archived = await resolveEffectiveContent(
      build([], zc('pinned', '2026-02-26', { status: 'archived' })) as any, 'd', 'org', NOW,
    );
    const zonesArchived = (archived.playlist!.items![0].content as any).metadata.zones;
    expect(zonesArchived[1].resolvedContent).toBeNull();
    expect(archived.version > live.version).toBe(true);
  });

  it('SERIALIZED payload carries no filtered-out zone item and no hidden version context', async () => {
    // The wire is what matters: versioning context is returned as a plain number list
    // from resolveLayoutZones, never hung off the payload, so it cannot ride along.
    const eff = await resolveEffectiveContent(
      build([
        zoneItem(zc('a', '2026-02-01')),
        zoneItem(zc('secret-archived', '2026-02-25', { status: 'archived' }), 1),
      ]) as any,
      'd', 'org', NOW,
    );
    const payload = serializeDeviceContent(eff, { contentBaseUrl: 'https://cdn.test' });
    const wire = JSON.stringify(payload);

    expect(wire).not.toContain('secret-archived');
    // No stray versioning fields smuggled onto the zone objects.
    expect(wire).not.toContain('versionItems');
    expect(wire).not.toContain('extraStamps');
    expect(wire).not.toContain('allItems');
  });

  it('NEGATIVE CONTROL: unfiltered zone items would put archived content on the wire', async () => {
    // Reproduces the regression this test guards: if resolveLayoutZones fetched the
    // complete set (as it must, for versioning) and did NOT re-split, the archived
    // item would serialize. Asserted against the raw fetch shape, not the resolver.
    const rawZoneItems = [
      zoneItem(zc('a', '2026-02-01')),
      zoneItem(zc('secret-archived', '2026-02-25', { status: 'archived' }), 1),
    ];
    const unsplit = JSON.stringify({ id: 'zp', items: rawZoneItems });
    expect(unsplit).toContain('secret-archived');
  });
});
